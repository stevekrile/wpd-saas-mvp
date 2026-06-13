using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Wpd.Domain.Enums;
using Wpd.Infrastructure.Data;
using Wpd.Infrastructure.Identity;

namespace Wpd.Application.Services.Auth;

public class AuthService : IAuthService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly IConfiguration _configuration;
    private readonly ApplicationDbContext _context;

    public AuthService(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        IConfiguration configuration,
        ApplicationDbContext context)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _configuration = configuration;
        _context = context;
    }

    public async Task<(bool Succeeded, string UserId, string Error)> RegisterAsync(string email, string password, string displayName)
    {
        // Get the Free tier ID (default for new users)
        var freeTier = _context.SubscriptionTiers.FirstOrDefault(t => t.Code == "FREE");
        if (freeTier == null)
        {
            return (false, string.Empty, "Subscription tiers not configured.");
        }

        var user = new ApplicationUser
        {
            UserName = email,
            Email = email,
            DisplayName = displayName,
            CreatedAt = DateTime.UtcNow,
            SubscriptionTierId = freeTier.Id
        };

        var result = await _userManager.CreateAsync(user, password);

        if (!result.Succeeded)
        {
            var errors = string.Join(", ", result.Errors.Select(e => e.Description));
            return (false, string.Empty, errors);
        }

        // Create default personal workspace
        var workspace = new Domain.Entities.Workspace
        {
            Name = $"{displayName}'s Workspace",
            OwnerUserId = user.Id,
            WorkspaceType = WorkspaceType.Personal,
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };

        _context.Workspaces.Add(workspace);
        await _context.SaveChangesAsync();

        // Update user with default workspace
        user.DefaultWorkspaceId = workspace.Id;
        await _userManager.UpdateAsync(user);

        return (true, user.Id, string.Empty);
    }

    public async Task<(bool Succeeded, ApplicationUser? User, string Error)> LoginAsync(string email, string password)
    {
        var user = await _userManager.FindByEmailAsync(email);
        if (user == null)
        {
            return (false, null, "Invalid email or password.");
        }

        var result = await _signInManager.CheckPasswordSignInAsync(user, password, lockoutOnFailure: false);

        if (!result.Succeeded)
        {
            return (false, null, "Invalid email or password.");
        }

        // Update last login
        user.LastLoginAt = DateTime.UtcNow;
        await _userManager.UpdateAsync(user);

        return (true, user, string.Empty);
    }

    public async Task<string> GenerateJwtTokenAsync(ApplicationUser user)
    {
        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id),
            new Claim(ClaimTypes.Email, user.Email ?? string.Empty),
            new Claim(ClaimTypes.Name, user.DisplayName),
            new Claim("SubscriptionTierId", user.SubscriptionTierId.ToString())
        };

        var roles = await _userManager.GetRolesAsync(user);
        claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Key"] ?? "YourSuperSecretKeyThatIsAtLeast32CharactersLong!"));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _configuration["Jwt:Issuer"],
            audience: _configuration["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddDays(7),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
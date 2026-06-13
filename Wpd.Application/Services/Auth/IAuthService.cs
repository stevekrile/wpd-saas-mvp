using Wpd.Infrastructure.Identity;

namespace Wpd.Application.Services.Auth;

public interface IAuthService
{
    Task<(bool Succeeded, string UserId, string Error)> RegisterAsync(string email, string password, string displayName);
    Task<(bool Succeeded, ApplicationUser? User, string Error)> LoginAsync(string email, string password);
    Task<string> GenerateJwtTokenAsync(ApplicationUser user);
}
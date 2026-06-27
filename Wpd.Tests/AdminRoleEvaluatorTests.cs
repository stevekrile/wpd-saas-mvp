using System.Security.Claims;
using Wpd.Application.Services.Admin;
using Wpd.Api.Security;

namespace Wpd.Tests;

public class AdminRoleEvaluatorTests
{
    [Fact]
    public void HasAnyRole_ReturnsTrue_ForAuthenticatedAdminRoleClaim()
    {
        var principal = CreatePrincipal(new Claim(ClaimTypes.Role, AdminRoles.Admin));

        var hasRole = AdminRoleEvaluator.HasAnyRole(principal, AdminRoles.Admin, AdminRoles.SystemAdmin);

        Assert.True(hasRole);
    }

    [Fact]
    public void HasAnyRole_ReturnsTrue_ForCommaSeparatedRolesClaim()
    {
        var principal = CreatePrincipal(new Claim("roles", "User, SystemAdmin"));

        var hasRole = AdminRoleEvaluator.HasAnyRole(principal, AdminRoles.SystemAdmin);

        Assert.True(hasRole);
    }

    [Fact]
    public void HasAnyRole_ReturnsFalse_ForAuthenticatedUserWithoutAllowedRole()
    {
        var principal = CreatePrincipal(new Claim("role", "User"));

        var hasRole = AdminRoleEvaluator.HasAnyRole(principal, AdminRoles.Admin, AdminRoles.SystemAdmin);

        Assert.False(hasRole);
    }

    [Fact]
    public void HasAnyRole_ReturnsFalse_ForUnauthenticatedPrincipal()
    {
        var identity = new ClaimsIdentity();
        var principal = new ClaimsPrincipal(identity);

        var hasRole = AdminRoleEvaluator.HasAnyRole(principal, AdminRoles.Admin);

        Assert.False(hasRole);
    }

    [Fact]
    public void AdminAuditService_ThrowsForNullDbContext()
    {
        Assert.Throws<ArgumentNullException>(() => new AdminAuditService(context: null!));
    }

    private static ClaimsPrincipal CreatePrincipal(params Claim[] claims)
    {
        var identity = new ClaimsIdentity(claims, "test-auth");
        return new ClaimsPrincipal(identity);
    }
}

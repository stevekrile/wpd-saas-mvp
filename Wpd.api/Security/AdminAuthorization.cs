using System.Security.Claims;

namespace Wpd.Api.Security;

public static class AdminRoles
{
    public const string Admin = "Admin";
    public const string SystemAdmin = "SystemAdmin";
}

public static class AdminAuthorizationPolicies
{
    public const string AdminPolicy = "AdminPolicy";
    public const string SystemAdminPolicy = "SystemAdminPolicy";
}

public static class AdminRoleEvaluator
{
    public static bool HasAnyRole(ClaimsPrincipal user, params string[] allowedRoles)
    {
        if (user.Identity?.IsAuthenticated != true || allowedRoles.Length == 0)
        {
            return false;
        }

        var allowedRoleSet = new HashSet<string>(allowedRoles, StringComparer.OrdinalIgnoreCase);
        foreach (var claim in user.Claims)
        {
            if (claim.Type is not (ClaimTypes.Role or "role" or "roles"))
            {
                continue;
            }

            foreach (var roleValue in claim.Value.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries))
            {
                if (allowedRoleSet.Contains(roleValue))
                {
                    return true;
                }
            }
        }

        return false;
    }
}

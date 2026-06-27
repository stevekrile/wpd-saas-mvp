using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Wpd.Infrastructure.Data;

namespace Wpd.Api.Middleware;

public class AdminStateEnforcementMiddleware
{
    private readonly RequestDelegate _next;

    public AdminStateEnforcementMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, ApplicationDbContext dbContext)
    {
        var endpoint = context.GetEndpoint();
        var allowAnonymous = endpoint?.Metadata.GetMetadata<IAllowAnonymous>() != null;
        var hasAuthorize = endpoint?.Metadata.GetMetadata<IAuthorizeData>() != null;

        if (allowAnonymous || !hasAuthorize)
        {
            await _next(context);
            return;
        }

        if (context.User?.Identity?.IsAuthenticated != true)
        {
            await _next(context);
            return;
        }

        var userId = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? context.User.FindFirst("sub")?.Value;

        if (string.IsNullOrWhiteSpace(userId))
        {
            await _next(context);
            return;
        }

        var userState = await dbContext.UserAdminStates
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.UserId == userId);

        if (userState is { IsActive: false })
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsJsonAsync(new
            {
                requestId = context.TraceIdentifier,
                errorCode = "UserDeactivated",
                message = "User access is deactivated."
            });
            return;
        }

        var user = await dbContext.WpdUsers.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
        if (user?.OrganizationId is int organizationId)
        {
            var accountState = await dbContext.AccountAdminStates
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.AccountId == organizationId);

            if (accountState is { IsActive: false })
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new
                {
                    requestId = context.TraceIdentifier,
                    errorCode = "AccountDeactivated",
                    message = "Account access is deactivated."
                });
                return;
            }
        }

        await _next(context);
    }
}

using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Wpd.Api.Middleware;
using Wpd.Application.Services.Admin;
using Wpd.Api.Security;
using Wpd.Application.Services.Processes;
using Wpd.Infrastructure.Data;
using Wpd.Infrastructure.Data.SeedData;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "WPD API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "Clerk JWT. Enter 'Bearer' [space] and your token.",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        sqlOptions =>
        {
            sqlOptions.MigrationsAssembly("Wpd.Infrastructure");
            sqlOptions.EnableRetryOnFailure(
                maxRetryCount: 5,
                maxRetryDelay: TimeSpan.FromSeconds(30),
                errorNumbersToAdd: null);
        }));

var clerkAuthority = builder.Configuration["Clerk:Authority"]
    ?? throw new InvalidOperationException("Clerk:Authority must be configured.");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = clerkAuthority;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = clerkAuthority,
            ValidateAudience = false,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(AdminAuthorizationPolicies.AdminPolicy, policy =>
        policy.RequireAssertion(context =>
            AdminRoleEvaluator.HasAnyRole(context.User, AdminRoles.Admin, AdminRoles.SystemAdmin)));

    options.AddPolicy(AdminAuthorizationPolicies.SystemAdminPolicy, policy =>
        policy.RequireAssertion(context =>
            AdminRoleEvaluator.HasAnyRole(context.User, AdminRoles.SystemAdmin)));
});

var allowedOrigins = builder.Configuration.GetSection("CORS:AllowedOrigins").Get<string[]>()
    ?? new[] { "https://localhost:5173", "https://127.0.0.1:5173" };
var allowedOriginSet = new HashSet<string>(allowedOrigins, StringComparer.OrdinalIgnoreCase);

builder.Services.AddScoped<IProcessService, ProcessService>();
builder.Services.AddScoped<IAdminAuditService, AdminAuditService>();
builder.Services.AddScoped<IAdminUserService, AdminUserService>();
builder.Services.AddScoped<IAdminUsageService, AdminUsageService>();
builder.Services.AddScoped<IAdminRecordAccessService, AdminRecordAccessService>();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var logger = services.GetRequiredService<ILogger<Program>>();

    try
    {
        var context = services.GetRequiredService<ApplicationDbContext>();
        await context.Database.MigrateAsync();
        await DbInitializer.SeedAsync(context);
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Database initialization failed during startup.");
        throw;
    }
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.Use(async (context, next) =>
{
    var incomingRequestId = context.Request.Headers["X-Request-Id"].ToString();
    if (!string.IsNullOrWhiteSpace(incomingRequestId))
    {
        context.TraceIdentifier = incomingRequestId;
    }

    context.Response.Headers["X-Request-Id"] = context.TraceIdentifier;
    await next();
});

app.Use(async (context, next) =>
{
    var origin = context.Request.Headers["Origin"].ToString();

    if (!string.IsNullOrWhiteSpace(origin) && allowedOriginSet.Contains(origin))
    {
        context.Response.Headers["Access-Control-Allow-Origin"] = origin;
        context.Response.Headers["Access-Control-Allow-Credentials"] = "true";
        context.Response.Headers["Vary"] = "Origin";
        context.Response.Headers["X-Debug-Origin"] = origin;

        var requestedHeaders = context.Request.Headers["Access-Control-Request-Headers"].ToString();
        context.Response.Headers["Access-Control-Allow-Headers"] = string.IsNullOrWhiteSpace(requestedHeaders)
            ? "Authorization, Content-Type"
            : requestedHeaders;
        context.Response.Headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,PATCH,DELETE,OPTIONS";
        context.Response.Headers["Access-Control-Expose-Headers"] = "X-Request-Id";

        if (HttpMethods.IsOptions(context.Request.Method))
        {
            context.Response.StatusCode = StatusCodes.Status204NoContent;
            return;
        }
    }

    await next();
});

app.UseAuthentication();
app.UseMiddleware<AdminStateEnforcementMiddleware>();
app.UseAuthorization();
app.MapControllers();

app.Run();
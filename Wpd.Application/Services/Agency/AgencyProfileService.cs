using Microsoft.EntityFrameworkCore;
using Wpd.Domain.Entities;
using Wpd.Infrastructure.Data;

namespace Wpd.Application.Services.Agency;

public class AgencyProfileService : IAgencyProfileService
{
    private static readonly LensDefinition[] LensDefinitions =
    [
        new LensDefinition(
            "business",
            "Business Systems",
            [
                "I can identify where process rules are documented and who owns them.",
                "I can challenge outdated rules and propose practical changes.",
                "I can align process expectations across teams for consistent execution.",
                "I can spot edge cases early and define workable exception paths.",
                "I can translate business intent into clear, usable process rules."
            ]),
        new LensDefinition(
            "information",
            "Information Systems",
            [
                "I can identify the data needed to run this process effectively.",
                "I can improve data capture so it is easy and reliable for users.",
                "I can detect data quality risks before they affect outcomes.",
                "I can turn process data into actionable insight for decisions.",
                "I can reduce technology friction and workarounds in this process."
            ]),
        new LensDefinition(
            "human",
            "People Systems",
            [
                "I can identify the skills and support people need to execute well.",
                "I can coach people on why the process matters, not just what to do.",
                "I can adjust workload expectations so quality does not degrade.",
                "I can lead change in a way people can adopt and sustain.",
                "I can align incentives so teams are motivated to follow the process."
            ]),
        new LensDefinition(
            "organizational",
            "Organizational Systems",
            [
                "I can clarify who is accountable for each part of this process.",
                "I can coordinate cross-functional stakeholders around shared outcomes.",
                "I can secure leadership support and resources for process priorities.",
                "I can define meaningful process indicators, not only lagging KPIs.",
                "I can navigate organizational constraints without losing process intent."
            ])
    ];

    private readonly ApplicationDbContext _context;

    public AgencyProfileService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<AgencyProfileModel?> GetProfileAsync(string userId)
    {
        var userExists = await _context.WpdUsers.AnyAsync(u => u.Id == userId);
        if (!userExists)
        {
            return null;
        }

        var profile = await GetOrCreateProfileAsync(userId);
        return BuildProfileModel(profile);
    }

    public async Task<(bool Succeeded, AgencyProfileModel? Profile, string Error)> SaveStatementScoreAsync(
        string userId,
        string lensKey,
        int statementNumber,
        int score)
    {
        if (score is < 1 or > 5)
        {
            return (false, null, "Score must be between 1 and 5.");
        }

        var lens = LensDefinitions.FirstOrDefault(l =>
            string.Equals(l.Key, lensKey, StringComparison.OrdinalIgnoreCase));
        if (lens == null)
        {
            return (false, null, $"Unsupported lens key '{lensKey}'.");
        }

        if (statementNumber < 1 || statementNumber > lens.Statements.Length)
        {
            return (false, null, $"Statement number must be between 1 and {lens.Statements.Length} for {lens.Name}.");
        }

        var userExists = await _context.WpdUsers.AnyAsync(u => u.Id == userId);
        if (!userExists)
        {
            return (false, null, "User profile not found. Call /api/auth/provision first.");
        }

        var normalizedLensKey = lens.Key;
        var statementText = lens.Statements[statementNumber - 1];
        const int maxAttempts = 2;

        for (var attempt = 1; attempt <= maxAttempts; attempt++)
        {
            var profile = await GetOrCreateProfileAsync(userId);

            var existing = await _context.AgencyLensAssessments
                .FirstOrDefaultAsync(a =>
                    a.AgencyProfileId == profile.Id &&
                    a.LensKey == normalizedLensKey &&
                    a.StatementNumber == statementNumber);

            if (existing == null)
            {
                existing = new AgencyLensAssessment
                {
                    AgencyProfileId = profile.Id,
                    LensKey = normalizedLensKey,
                    LensName = lens.Name,
                    StatementNumber = statementNumber,
                    StatementText = statementText,
                    AgencyScore = score,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                _context.AgencyLensAssessments.Add(existing);
            }
            else
            {
                existing.LensName = lens.Name;
                existing.StatementText = statementText;
                existing.AgencyScore = score;
                existing.UpdatedAt = DateTime.UtcNow;
            }

            profile.UpdatedAt = DateTime.UtcNow;

            try
            {
                await _context.SaveChangesAsync();

                var refreshedProfile = await _context.AgencyProfiles
                    .Include(p => p.LensAssessments)
                    .FirstAsync(p => p.Id == profile.Id);
                return (true, BuildProfileModel(refreshedProfile), string.Empty);
            }
            catch (DbUpdateException) when (attempt < maxAttempts)
            {
                _context.ChangeTracker.Clear();
            }
        }

        return (false, null, "Failed to save agency score due to a conflicting update. Please retry.");
    }

    private async Task<AgencyProfile> GetOrCreateProfileAsync(string userId)
    {
        var profile = await _context.AgencyProfiles
            .Include(p => p.LensAssessments)
            .FirstOrDefaultAsync(p => p.UserId == userId);

        if (profile != null)
        {
            return profile;
        }

        profile = new AgencyProfile
        {
            UserId = userId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.AgencyProfiles.Add(profile);
        await _context.SaveChangesAsync();

        return profile;
    }

    private static AgencyProfileModel BuildProfileModel(AgencyProfile profile)
    {
        var lensModels = LensDefinitions.Select(lens =>
        {
            var assessments = profile.LensAssessments
                .Where(a => string.Equals(a.LensKey, lens.Key, StringComparison.OrdinalIgnoreCase))
                .ToDictionary(a => a.StatementNumber, a => a);

            var statementModels = Enumerable.Range(1, lens.Statements.Length)
                .Select(statementNumber =>
                {
                    assessments.TryGetValue(statementNumber, out var assessment);
                    return new AgencyStatementModel
                    {
                        StatementNumber = statementNumber,
                        StatementText = lens.Statements[statementNumber - 1],
                        Score = assessment?.AgencyScore
                    };
                })
                .ToList();

            var scoredValues = statementModels
                .Where(s => s.Score.HasValue)
                .Select(s => s.Score!.Value)
                .ToList();

            return new AgencyLensModel
            {
                LensKey = lens.Key,
                LensName = lens.Name,
                AgencyScore = scoredValues.Count > 0
                    ? Math.Round((decimal)scoredValues.Average(), 2)
                    : null,
                AnsweredStatements = scoredValues.Count,
                TotalStatements = lens.Statements.Length,
                Statements = statementModels
            };
        }).ToList();

        var updatedAt = profile.LensAssessments.Count > 0
            ? profile.LensAssessments.Max(a => a.UpdatedAt)
            : profile.UpdatedAt;

        return new AgencyProfileModel
        {
            UserId = profile.UserId,
            UpdatedAt = updatedAt,
            Lenses = lensModels
        };
    }

    private sealed record LensDefinition(string Key, string Name, string[] Statements);
}

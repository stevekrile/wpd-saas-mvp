using Wpd.Domain.Entities;
using Wpd.Infrastructure.Data;

namespace Wpd.Infrastructure.Data.SeedData;

public static class DbInitializer
{
    public static async Task SeedAsync(ApplicationDbContext context)
    {
        // Seed Subscription Tiers
        if (!context.SubscriptionTiers.Any())
        {
            var tiers = new List<SubscriptionTier>
            {
                new SubscriptionTier
                {
                    Name = "Public",
                    Code = "PUBLIC",
                    MaxActiveProcesses = 0,
                    AllowsExports = false,
                    AllowsArtifacts = false,
                    AllowsAiAssistance = false,
                    AllowsTeamWorkspaces = false,
                    AllowsEnterpriseAdmin = false,
                    CreatedAt = DateTime.UtcNow
                },
                new SubscriptionTier
                {
                    Name = "Free",
                    Code = "FREE",
                    MaxActiveProcesses = 3,
                    AllowsExports = false,
                    AllowsArtifacts = false,
                    AllowsAiAssistance = false,
                    AllowsTeamWorkspaces = false,
                    AllowsEnterpriseAdmin = false,
                    CreatedAt = DateTime.UtcNow
                },
                new SubscriptionTier
                {
                    Name = "Pro",
                    Code = "PRO",
                    MaxActiveProcesses = -1, // -1 = unlimited
                    AllowsExports = true,
                    AllowsArtifacts = true,
                    AllowsAiAssistance = true,
                    AllowsTeamWorkspaces = false,
                    AllowsEnterpriseAdmin = false,
                    CreatedAt = DateTime.UtcNow
                },
                new SubscriptionTier
                {
                    Name = "Enterprise",
                    Code = "ENTERPRISE",
                    MaxActiveProcesses = -1,
                    AllowsExports = true,
                    AllowsArtifacts = true,
                    AllowsAiAssistance = true,
                    AllowsTeamWorkspaces = true,
                    AllowsEnterpriseAdmin = true,
                    CreatedAt = DateTime.UtcNow
                }
            };

            context.SubscriptionTiers.AddRange(tiers);
            await context.SaveChangesAsync();
        }

        // Seed Lenses
        if (!context.Lenses.Any())
        {
            var lenses = new List<Lens>
            {
                new Lens
                {
                    Name = "Business Systems",
                    Code = "BUSINESS",
                    DisplayOrder = 1,
                    PublicDescription = "The rules, policies, and business logic that define how work should be done. Business systems establish the 'what' and 'why' of your processes.",
                    InternalDescription = "Business Systems encompass the documented rules, procedures, standards, and guidelines that govern process execution. Maturity ranges from personality-driven (Level I) through documents (Level II) and management systems (Level III) to operating systems with process maps, procedures, standards, and work instructions (Level IV)."
                },
                new Lens
                {
                    Name = "Information Systems",
                    Code = "INFORMATION",
                    DisplayOrder = 2,
                    PublicDescription = "The data, technology, and information flows that enable reliable execution and insight. Information systems turn process intent into measurable reality.",
                    InternalDescription = "Information Systems include four critical pillars: Model (data structure and organization), Acquisition & Transformation (how data enters the system), Validation (ensuring quality and accuracy), and Analysis & Intelligence (insights and dashboards). Strong information systems make the invisible visible."
                },
                new Lens
                {
                    Name = "Human Systems",
                    Code = "HUMAN",
                    DisplayOrder = 3,
                    PublicDescription = "The people, skills, knowledge, and behaviors required to execute the process. Human systems ensure the right capabilities exist at the right time.",
                    InternalDescription = "Human Systems address capability alignment across four levels: Awareness (basic recognition with low dependency), Knowledge (retained understanding with moderate dependency), Skills (reliable execution with elevated dependency), and Expert (contextual judgment with existential dependency). Training, change management, and incentives are core human system elements."
                },
                new Lens
                {
                    Name = "Organizational Systems",
                    Code = "ORGANIZATIONAL",
                    DisplayOrder = 4,
                    PublicDescription = "The structure, roles, accountability, and outcomes that shape how value flows through the organization. Organizational systems determine who does what and why it matters.",
                    InternalDescription = "Organizational Systems examine Structure (reporting lines and organizational design), Value (expectations, talent, cross-functional alignment, and boundaries), and Outcomes (Key Activity Indicators vs Key Performance Indicators). Strong organizational alignment ensures process design matches organizational reality."
                }
            };

            context.Lenses.AddRange(lenses);
            await context.SaveChangesAsync();
        }

        const string bootstrapSuperAdminEmail = "stevekrile@gmail.com";
        var bootstrapUser = context.WpdUsers.FirstOrDefault(u => u.Email == bootstrapSuperAdminEmail);
        if (bootstrapUser != null)
        {
            var existingState = context.UserAdminStates.FirstOrDefault(s => s.UserId == bootstrapUser.Id);
            if (existingState == null)
            {
                existingState = new UserAdminState
                {
                    UserId = bootstrapUser.Id,
                    IsActive = true
                };
                context.UserAdminStates.Add(existingState);
            }

            existingState.AssignedRole = "SystemAdmin";
            existingState.IsActive = true;
            await context.SaveChangesAsync();
        }
        // Seed Diagnostic Questions
        if (!context.DiagnosticQuestions.Any())
        {
            var businessLensId = context.Lenses.First(l => l.Code == "BUSINESS").Id;
            var informationLensId = context.Lenses.First(l => l.Code == "INFORMATION").Id;
            var humanLensId = context.Lenses.First(l => l.Code == "HUMAN").Id;
            var organizationalLensId = context.Lenses.First(l => l.Code == "ORGANIZATIONAL").Id;

            var questions = new List<DiagnosticQuestion>
            {
                // Business Systems Questions - Focus on documentation maturity and clarity
                new DiagnosticQuestion
                {
                    LensId = businessLensId,
                    QuestionText = "Business rules for this process are clearly documented and easily accessible to everyone who needs them.",
                    HelpText = "Consider whether your process relies on personality and tribal knowledge, or whether documented procedures and standards guide execution consistently.",
                    DisplayOrder = 1,
                    IsRequired = true,
                    IsActive = true,
                    FreeTierVisible = true,
                    Weight = 1.0m
                },
                new DiagnosticQuestion
                {
                    LensId = businessLensId,
                    QuestionText = "There is clear ownership and authority over business rules and process decisions.",
                    HelpText = "Think about who can change the rules. Is it clear, or does the process drift based on whoever is in charge at the moment?",
                    DisplayOrder = 2,
                    IsRequired = true,
                    IsActive = true,
                    FreeTierVisible = true,
                    Weight = 1.0m
                },
                new DiagnosticQuestion
                {
                    LensId = businessLensId,
                    QuestionText = "Business rules are applied consistently across teams, locations, and situations.",
                    HelpText = "Consider whether different people or teams follow the same rules differently, or if execution varies based on who's involved.",
                    DisplayOrder = 3,
                    IsRequired = true,
                    IsActive = true,
                    FreeTierVisible = true,
                    Weight = 1.0m
                },
                new DiagnosticQuestion
                {
                    LensId = businessLensId,
                    QuestionText = "The process includes clear guidance for exceptions and edge cases.",
                    HelpText = "Think about what happens when things don't go according to plan. Is there documented guidance, or do people improvise?",
                    DisplayOrder = 4,
                    IsRequired = true,
                    IsActive = true,
                    FreeTierVisible = true,
                    Weight = 1.0m
                },
                new DiagnosticQuestion
                {
                    LensId = businessLensId,
                    QuestionText = "The process design reflects operational reality, not just theoretical best practice.",
                    HelpText = "Consider whether your documented process matches how work actually gets done, or if people work around the official process.",
                    DisplayOrder = 5,
                    IsRequired = true,
                    IsActive = true,
                    FreeTierVisible = true,
                    Weight = 1.0m
                },

                // Information Systems Questions - Focus on the four pillars: Model, Acquisition, Validation, Analysis
                new DiagnosticQuestion
                {
                    LensId = informationLensId,
                    QuestionText = "The data model is well-designed and appropriate for the information we need to capture.",
                    HelpText = "Consider whether the structure of your data makes sense, or if you're forcing information into poorly designed fields and spreadsheets.",
                    DisplayOrder = 1,
                    IsRequired = true,
                    IsActive = true,
                    FreeTierVisible = true,
                    Weight = 1.0m
                },
                new DiagnosticQuestion
                {
                    LensId = informationLensId,
                    QuestionText = "Data acquisition is easy and doesn't require significant training or workarounds.",
                    HelpText = "Think about whether people can easily provide the information needed, or if data entry is confusing, time-consuming, or requires expert knowledge.",
                    DisplayOrder = 2,
                    IsRequired = true,
                    IsActive = true,
                    FreeTierVisible = true,
                    Weight = 1.0m
                },
                new DiagnosticQuestion
                {
                    LensId = informationLensId,
                    QuestionText = "Data quality is validated and errors are caught early in the process.",
                    HelpText = "Consider whether you trust the data in your systems, or if you frequently discover errors, inconsistencies, or missing information.",
                    DisplayOrder = 3,
                    IsRequired = true,
                    IsActive = true,
                    FreeTierVisible = true,
                    Weight = 1.0m
                },
                new DiagnosticQuestion
                {
                    LensId = informationLensId,
                    QuestionText = "Analysis and reporting provide clear, actionable insights for decision-making.",
                    HelpText = "Think about whether your dashboards and reports help you understand what's happening, or if you spend more time questioning the numbers than using them.",
                    DisplayOrder = 4,
                    IsRequired = true,
                    IsActive = true,
                    FreeTierVisible = true,
                    Weight = 1.0m
                },
                new DiagnosticQuestion
                {
                    LensId = informationLensId,
                    QuestionText = "Technology systems supporting this process work reliably without frequent workarounds.",
                    HelpText = "Consider system downtime, manual interventions, data re-entry across systems, and whether technology helps or hinders the work.",
                    DisplayOrder = 5,
                    IsRequired = true,
                    IsActive = true,
                    FreeTierVisible = true,
                    Weight = 1.0m
                },

                // Human Systems Questions - Focus on training levels and change management
                new DiagnosticQuestion
                {
                    LensId = humanLensId,
                    QuestionText = "People have the appropriate level of training for their role in this process.",
                    HelpText = "Consider whether people have awareness, knowledge, skills, or expertise appropriate to what you're asking them to do.",
                    DisplayOrder = 1,
                    IsRequired = true,
                    IsActive = true,
                    FreeTierVisible = true,
                    Weight = 1.0m
                },
                new DiagnosticQuestion
                {
                    LensId = humanLensId,
                    QuestionText = "People understand not just what to do, but why the process matters and how it creates value.",
                    HelpText = "Think about whether people see the bigger picture or just follow steps mechanically without understanding the purpose.",
                    DisplayOrder = 2,
                    IsRequired = true,
                    IsActive = true,
                    FreeTierVisible = true,
                    Weight = 1.0m
                },
                new DiagnosticQuestion
                {
                    LensId = humanLensId,
                    QuestionText = "People have enough time and capacity to complete this process well without cutting corners.",
                    HelpText = "Consider workload, competing priorities, and whether people are stretched too thin to execute the process as designed.",
                    DisplayOrder = 3,
                    IsRequired = true,
                    IsActive = true,
                    FreeTierVisible = true,
                    Weight = 1.0m
                },
                new DiagnosticQuestion
                {
                    LensId = humanLensId,
                    QuestionText = "Change management has properly prepared people for how this process works.",
                    HelpText = "Think about whether people were brought along during design, or if changes were dropped on them without context or preparation.",
                    DisplayOrder = 4,
                    IsRequired = true,
                    IsActive = true,
                    FreeTierVisible = true,
                    Weight = 1.0m
                },
                new DiagnosticQuestion
                {
                    LensId = humanLensId,
                    QuestionText = "People are properly incentivized to execute this process correctly.",
                    HelpText = "Consider whether executing this process helps people achieve their goals, or if they're incentivized to work around it.",
                    DisplayOrder = 5,
                    IsRequired = true,
                    IsActive = true,
                    FreeTierVisible = true,
                    Weight = 1.0m
                },

                // Organizational Systems Questions - Focus on Structure, Value, and Outcomes
                new DiagnosticQuestion
                {
                    LensId = organizationalLensId,
                    QuestionText = "Roles and responsibilities for this process are clearly defined and understood.",
                    HelpText = "Consider whether people know who is responsible for what, or if accountability is unclear and work falls through the cracks.",
                    DisplayOrder = 1,
                    IsRequired = true,
                    IsActive = true,
                    FreeTierVisible = true,
                    Weight = 1.0m
                },
                new DiagnosticQuestion
                {
                    LensId = organizationalLensId,
                    QuestionText = "The organizational structure supports effective execution of this process.",
                    HelpText = "Think about reporting lines, departmental boundaries, and whether the structure helps or hinders cross-functional work.",
                    DisplayOrder = 2,
                    IsRequired = true,
                    IsActive = true,
                    FreeTierVisible = true,
                    Weight = 1.0m
                },
                new DiagnosticQuestion
                {
                    LensId = organizationalLensId,
                    QuestionText = "The business values this process enough to provide proper resources and support.",
                    HelpText = "Consider whether leadership sees this work as critical, or if it's treated as overhead that competes for attention and funding.",
                    DisplayOrder = 3,
                    IsRequired = true,
                    IsActive = true,
                    FreeTierVisible = true,
                    Weight = 1.0m
                },
                new DiagnosticQuestion
                {
                    LensId = organizationalLensId,
                    QuestionText = "Success is measured with meaningful activity indicators, not just outcome metrics.",
                    HelpText = "Think about whether you measure process health (how well the system runs) or just outcomes (which may be outside your control).",
                    DisplayOrder = 4,
                    IsRequired = true,
                    IsActive = true,
                    FreeTierVisible = true,
                    Weight = 1.0m
                },
                new DiagnosticQuestion
                {
                    LensId = organizationalLensId,
                    QuestionText = "Cross-functional teams collaborate effectively without turf battles or silos.",
                    HelpText = "Consider handoffs between departments, communication patterns, and whether organizational boundaries create friction in execution.",
                    DisplayOrder = 5,
                    IsRequired = true,
                    IsActive = true,
                    FreeTierVisible = true,
                    Weight = 1.0m
                }
            };

            context.DiagnosticQuestions.AddRange(questions);
            await context.SaveChangesAsync();
        }
    }
}



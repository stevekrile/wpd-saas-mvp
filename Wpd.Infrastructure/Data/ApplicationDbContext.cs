using Microsoft.EntityFrameworkCore;
using Wpd.Domain.Entities;

namespace Wpd.Infrastructure.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<WpdUser> WpdUsers { get; set; }
    public DbSet<SubscriptionTier> SubscriptionTiers { get; set; }
    public DbSet<Organization> Organizations { get; set; }
    public DbSet<Workspace> Workspaces { get; set; }
    public DbSet<Process> Processes { get; set; }
    public DbSet<Lens> Lenses { get; set; }
    public DbSet<DiagnosticQuestion> DiagnosticQuestions { get; set; }
    public DbSet<Diagnostic> Diagnostics { get; set; }
    public DbSet<DiagnosticResponse> DiagnosticResponses { get; set; }
    public DbSet<DiagnosticLensNote> DiagnosticLensNotes { get; set; }
    public DbSet<DiagnosticLlmResult> DiagnosticLlmResults { get; set; }
    public DbSet<LensScore> LensScores { get; set; }
    public DbSet<SystemTension> SystemTensions { get; set; }
    public DbSet<UpgradeEvent> UpgradeEvents { get; set; }
    public DbSet<UserAdminState> UserAdminStates { get; set; }
    public DbSet<AccountAdminState> AccountAdminStates { get; set; }
    public DbSet<AdminAuditEvent> AdminAuditEvents { get; set; }
    public DbSet<AdminRecordAccessEvent> AdminRecordAccessEvents { get; set; }
    public DbSet<AgencyProfile> AgencyProfiles { get; set; }
    public DbSet<AgencyLensAssessment> AgencyLensAssessments { get; set; }
    public DbSet<UserLlmCredential> UserLlmCredentials { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Configure decimal precision for scores
        modelBuilder.Entity<DiagnosticQuestion>()
            .Property(q => q.Weight)
            .HasPrecision(5, 2);

        modelBuilder.Entity<LensScore>()
            .Property(s => s.RawScore)
            .HasPrecision(5, 2);

        modelBuilder.Entity<LensScore>()
            .Property(s => s.NormalizedScore)
            .HasPrecision(5, 2);

        // Configure relationships
        modelBuilder.Entity<Workspace>()
            .HasOne(w => w.Organization)
            .WithMany(o => o.Workspaces)
            .HasForeignKey(w => w.OrganizationId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Process>()
            .HasOne(p => p.Workspace)
            .WithMany(w => w.Processes)
            .HasForeignKey(p => p.WorkspaceId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Diagnostic>()
            .HasOne(d => d.Process)
            .WithMany(p => p.Diagnostics)
            .HasForeignKey(d => d.ProcessId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Diagnostic>()
            .HasOne(d => d.PrimaryLens)
            .WithMany()
            .HasForeignKey(d => d.PrimaryLensId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<DiagnosticQuestion>()
            .HasOne(q => q.Lens)
            .WithMany(l => l.DiagnosticQuestions)
            .HasForeignKey(q => q.LensId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<DiagnosticResponse>()
            .HasOne(r => r.Diagnostic)
            .WithMany(d => d.DiagnosticResponses)
            .HasForeignKey(r => r.DiagnosticId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<DiagnosticResponse>()
            .HasOne(r => r.DiagnosticQuestion)
            .WithMany(q => q.DiagnosticResponses)
            .HasForeignKey(r => r.DiagnosticQuestionId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<DiagnosticLensNote>()
            .Property(n => n.LensKey)
            .HasMaxLength(50);

        modelBuilder.Entity<DiagnosticLensNote>()
            .HasIndex(n => new { n.DiagnosticId, n.LensKey })
            .IsUnique();

        modelBuilder.Entity<DiagnosticLensNote>()
            .HasOne(n => n.Diagnostic)
            .WithMany(d => d.DiagnosticLensNotes)
            .HasForeignKey(n => n.DiagnosticId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<DiagnosticLlmResult>()
            .HasOne(r => r.Diagnostic)
            .WithMany(d => d.DiagnosticLlmResults)
            .HasForeignKey(r => r.DiagnosticId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<DiagnosticLlmResult>()
            .Property(r => r.ResultMarkdown)
            .HasMaxLength(16000);

        modelBuilder.Entity<DiagnosticLlmResult>()
            .Property(r => r.Provider)
            .HasMaxLength(50);

        modelBuilder.Entity<DiagnosticLlmResult>()
            .Property(r => r.Model)
            .HasMaxLength(120);

        modelBuilder.Entity<DiagnosticLlmResult>()
            .HasIndex(r => new { r.DiagnosticId, r.CreatedAt });

        modelBuilder.Entity<Diagnostic>()
            .Property(d => d.CurrentLlmProvider)
            .HasMaxLength(50);

        modelBuilder.Entity<Diagnostic>()
            .Property(d => d.CurrentLlmModel)
            .HasMaxLength(120);

        modelBuilder.Entity<LensScore>()
            .HasOne(s => s.Diagnostic)
            .WithMany(d => d.LensScores)
            .HasForeignKey(s => s.DiagnosticId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<LensScore>()
            .HasOne(s => s.Lens)
            .WithMany(l => l.LensScores)
            .HasForeignKey(s => s.LensId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<SystemTension>()
            .HasOne(t => t.Diagnostic)
            .WithMany(d => d.SystemTensions)
            .HasForeignKey(t => t.DiagnosticId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<SystemTension>()
            .HasOne(t => t.Lens)
            .WithMany(l => l.SystemTensions)
            .HasForeignKey(t => t.LensId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<UserAdminState>()
            .HasKey(s => s.UserId);

        modelBuilder.Entity<UserAdminState>()
            .Property(s => s.UserId)
            .HasMaxLength(128);

        modelBuilder.Entity<UserAdminState>()
            .Property(s => s.AssignedRole)
            .HasMaxLength(50);

        modelBuilder.Entity<UserAdminState>()
            .Property(s => s.DeactivatedByUserId)
            .HasMaxLength(128);

        modelBuilder.Entity<UserAdminState>()
            .Property(s => s.ReactivatedByUserId)
            .HasMaxLength(128);

        modelBuilder.Entity<UserAdminState>()
            .HasIndex(s => new { s.AccountId, s.WorkspaceId });

        modelBuilder.Entity<AccountAdminState>()
            .HasKey(s => s.AccountId);

        modelBuilder.Entity<AccountAdminState>()
            .Property(s => s.AccountId)
            .ValueGeneratedNever();

        modelBuilder.Entity<AccountAdminState>()
            .Property(s => s.DeactivatedByUserId)
            .HasMaxLength(128);

        modelBuilder.Entity<AdminAuditEvent>()
            .Property(e => e.ActorUserId)
            .HasMaxLength(128);

        modelBuilder.Entity<AdminAuditEvent>()
            .Property(e => e.ActorRole)
            .HasMaxLength(50);

        modelBuilder.Entity<AdminAuditEvent>()
            .Property(e => e.ActionType)
            .HasMaxLength(100);

        modelBuilder.Entity<AdminAuditEvent>()
            .Property(e => e.TargetType)
            .HasMaxLength(100);

        modelBuilder.Entity<AdminAuditEvent>()
            .Property(e => e.TargetId)
            .HasMaxLength(128);

        modelBuilder.Entity<AdminAuditEvent>()
            .HasIndex(e => e.CreatedAt);

        modelBuilder.Entity<AdminAuditEvent>()
            .HasIndex(e => new { e.ActorUserId, e.CreatedAt });

        modelBuilder.Entity<AdminAuditEvent>()
            .HasIndex(e => new { e.AccountId, e.WorkspaceId, e.CreatedAt });

        modelBuilder.Entity<AdminRecordAccessEvent>()
            .Property(e => e.ActorUserId)
            .HasMaxLength(128);

        modelBuilder.Entity<AdminRecordAccessEvent>()
            .Property(e => e.RecordType)
            .HasMaxLength(100);

        modelBuilder.Entity<AdminRecordAccessEvent>()
            .Property(e => e.RecordId)
            .HasMaxLength(128);

        modelBuilder.Entity<AdminRecordAccessEvent>()
            .HasIndex(e => e.CreatedAt);

        modelBuilder.Entity<AdminRecordAccessEvent>()
            .HasIndex(e => new { e.ActorUserId, e.CreatedAt });

        modelBuilder.Entity<AgencyProfile>()
            .Property(p => p.UserId)
            .HasMaxLength(128);

        modelBuilder.Entity<AgencyProfile>()
            .HasIndex(p => p.UserId)
            .IsUnique();

        modelBuilder.Entity<AgencyLensAssessment>()
            .Property(a => a.LensKey)
            .HasMaxLength(50);

        modelBuilder.Entity<AgencyLensAssessment>()
            .Property(a => a.LensName)
            .HasMaxLength(120);

        modelBuilder.Entity<AgencyLensAssessment>()
            .Property(a => a.StatementText)
            .HasMaxLength(500);

        modelBuilder.Entity<AgencyLensAssessment>()
            .HasIndex(a => new { a.AgencyProfileId, a.LensKey, a.StatementNumber })
            .IsUnique();

        modelBuilder.Entity<AgencyLensAssessment>()
            .HasOne(a => a.AgencyProfile)
            .WithMany(p => p.LensAssessments)
            .HasForeignKey(a => a.AgencyProfileId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<UserLlmCredential>()
            .Property(c => c.UserId)
            .HasMaxLength(450);

        modelBuilder.Entity<UserLlmCredential>()
            .Property(c => c.Provider)
            .HasMaxLength(50);

        modelBuilder.Entity<UserLlmCredential>()
            .Property(c => c.EncryptedApiKey)
            .HasMaxLength(4000);

        modelBuilder.Entity<UserLlmCredential>()
            .Property(c => c.KeyHint)
            .HasMaxLength(32);

        modelBuilder.Entity<UserLlmCredential>()
            .HasIndex(c => new { c.UserId, c.Provider })
            .IsUnique();

        modelBuilder.Entity<UserLlmCredential>()
            .HasOne(c => c.User)
            .WithMany(u => u.LlmCredentials)
            .HasForeignKey(c => c.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
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
    public DbSet<LensScore> LensScores { get; set; }
    public DbSet<SystemTension> SystemTensions { get; set; }
    public DbSet<UpgradeEvent> UpgradeEvents { get; set; }

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
    }
}
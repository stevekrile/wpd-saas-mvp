using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Wpd.Infrastructure.Data;

public class ApplicationDbContextFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
{
    public ApplicationDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<ApplicationDbContext>();
        optionsBuilder.UseSqlServer(
            "Server=(localdb)\\mssqllocaldb;Database=WpdDb;Trusted_Connection=true;MultipleActiveResultSets=true",
            sqlOptions => sqlOptions.MigrationsAssembly("Wpd.Infrastructure"));

        return new ApplicationDbContext(optionsBuilder.Options);
    }
}

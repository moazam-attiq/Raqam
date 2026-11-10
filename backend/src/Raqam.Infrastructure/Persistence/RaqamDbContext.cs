using Microsoft.EntityFrameworkCore;

namespace Raqam.Infrastructure.Persistence;

public class RaqamDbContext(DbContextOptions<RaqamDbContext> options) : DbContext(options)
{
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Picks up every IEntityTypeConfiguration<T> in this assembly as entities are added.
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(RaqamDbContext).Assembly);
    }
}

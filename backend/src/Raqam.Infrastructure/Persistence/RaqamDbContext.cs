using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Raqam.Infrastructure.Identity;

namespace Raqam.Infrastructure.Persistence;

public class RaqamDbContext(DbContextOptions<RaqamDbContext> options)
    : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>(options)
{
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Picks up every IEntityTypeConfiguration<T> in this assembly as entities are added.
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(RaqamDbContext).Assembly);
    }
}

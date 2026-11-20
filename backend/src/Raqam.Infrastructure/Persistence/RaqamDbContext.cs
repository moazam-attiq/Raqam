using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Raqam.Domain.Accounts;
using Raqam.Domain.Budgets;
using Raqam.Domain.Categories;
using Raqam.Domain.Transactions;
using Raqam.Infrastructure.Identity;

namespace Raqam.Infrastructure.Persistence;

public class RaqamDbContext(DbContextOptions<RaqamDbContext> options)
    : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>(options)
{
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Transaction> Transactions => Set<Transaction>();
    public DbSet<Budget> Budgets => Set<Budget>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Picks up every IEntityTypeConfiguration<T> in this assembly as entities are added.
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(RaqamDbContext).Assembly);
    }
}

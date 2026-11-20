using Raqam.Domain.Budgets;
using Xunit;

namespace Raqam.Domain.Tests;

public class BudgetProgressTests
{
    private static BudgetProgress Calc(string amount, string spent) =>
        BudgetProgress.Calculate(TestData.Amount(amount), TestData.Amount(spent));

    [Fact]
    public void Nothing_spent_is_on_track_with_the_whole_amount_remaining()
    {
        var progress = Calc("1000", "0");

        Assert.Equal(BudgetStatus.OnTrack, progress.Status);
        Assert.Equal(0m, progress.PercentUsed);
        Assert.Equal(1000m, progress.Remaining);
        Assert.Equal(0m, progress.Spent);
    }

    [Theory]
    [InlineData("100", "79.99", BudgetStatus.OnTrack)]
    [InlineData("100", "80", BudgetStatus.NearLimit)]
    [InlineData("100", "99.99", BudgetStatus.NearLimit)]
    [InlineData("100", "100", BudgetStatus.LimitReached)]
    [InlineData("100", "100.01", BudgetStatus.LimitReached)]
    [InlineData("100", "250", BudgetStatus.LimitReached)]
    public void The_status_changes_exactly_at_80_and_100_percent(string amount, string spent, BudgetStatus expected)
    {
        Assert.Equal(expected, Calc(amount, spent).Status);
    }

    [Fact]
    public void Exactly_80_percent_of_an_awkward_amount_is_near_the_limit_without_rounding_trouble()
    {
        // 2.40 of 3.00 is exactly 80% even though 2.4 / 3 is awkward in floating point.
        var progress = Calc("3", "2.4");

        Assert.Equal(BudgetStatus.NearLimit, progress.Status);
        Assert.Equal(80m, progress.PercentUsed);
    }

    [Fact]
    public void The_percentage_is_cut_off_never_rounded_up_so_it_never_shows_a_threshold_early()
    {
        // 2.39 of 3.00 is 79.666...%: still on track, and shown as 79.66, not 79.67 or 80.
        var progress = Calc("3", "2.39");

        Assert.Equal(BudgetStatus.OnTrack, progress.Status);
        Assert.Equal(79.66m, progress.PercentUsed);
    }

    [Fact]
    public void Remaining_goes_negative_once_the_budget_is_exceeded()
    {
        var progress = Calc("200", "250.50");

        Assert.Equal(-50.50m, progress.Remaining);
        Assert.Equal(125.25m, progress.PercentUsed);
        Assert.Equal(BudgetStatus.LimitReached, progress.Status);
    }

    [Fact]
    public void Spending_exactly_the_amount_leaves_nothing_and_counts_as_reached()
    {
        var progress = Calc("500", "500");

        Assert.Equal(0m, progress.Remaining);
        Assert.Equal(100m, progress.PercentUsed);
        Assert.Equal(BudgetStatus.LimitReached, progress.Status);
    }

    [Theory]
    [InlineData("0")]
    [InlineData("-5")]
    public void An_amount_that_is_not_above_zero_is_a_programming_error(string amount)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => Calc(amount, "10"));
    }
}

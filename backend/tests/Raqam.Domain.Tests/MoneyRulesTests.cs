using Raqam.Domain.Common;
using Xunit;

namespace Raqam.Domain.Tests;

public class MoneyRulesTests
{
    [Theory]
    [InlineData("0.01")]
    [InlineData("1")]
    [InlineData("1234.56")]
    [InlineData("9999999999999999.99")]
    public void PositiveAmount_accepts_valid_values(string text)
    {
        var amount = TestData.Amount(text);

        Assert.Equal(amount, MoneyRules.EnsurePositiveAmount(amount));
    }

    [Theory]
    [InlineData("0")]
    [InlineData("-0.01")]
    [InlineData("-100")]
    public void PositiveAmount_rejects_zero_and_negative(string text)
    {
        Assert.Throws<DomainException>(() => MoneyRules.EnsurePositiveAmount(TestData.Amount(text)));
    }

    [Theory]
    [InlineData("10.001")]
    [InlineData("0.005")]
    [InlineData("1.999")]
    public void PositiveAmount_rejects_more_than_two_decimals_instead_of_rounding(string text)
    {
        Assert.Throws<DomainException>(() => MoneyRules.EnsurePositiveAmount(TestData.Amount(text)));
    }

    [Fact]
    public void PositiveAmount_rejects_values_beyond_numeric_18_2()
    {
        // One cent above the largest value numeric(18,2) holds.
        Assert.Throws<DomainException>(() => MoneyRules.EnsurePositiveAmount(10_000_000_000_000_000.00m));
    }

    [Fact]
    public void PositiveAmount_treats_trailing_zeros_as_valid()
    {
        Assert.Equal(10.50m, MoneyRules.EnsurePositiveAmount(10.500m));
    }

    [Theory]
    [InlineData("0")]
    [InlineData("5000.50")]
    [InlineData("9999999999999999.99")]
    public void Balance_allows_zero_and_positive(string text)
    {
        var balance = TestData.Amount(text);

        Assert.Equal(balance, MoneyRules.EnsureValidBalance(balance));
    }

    // D049: an account never starts below zero.
    [Theory]
    [InlineData("-0.01")]
    [InlineData("-200")]
    [InlineData("-9999999999999999.99")]
    public void Balance_rejects_negative(string text)
    {
        Assert.Throws<DomainException>(() => MoneyRules.EnsureValidBalance(TestData.Amount(text)));
    }

    [Theory]
    [InlineData("1.001")]
    [InlineData("-1.001")]
    public void Balance_rejects_more_than_two_decimals(string text)
    {
        Assert.Throws<DomainException>(() => MoneyRules.EnsureValidBalance(TestData.Amount(text)));
    }

    [Theory]
    [InlineData("10000000000000000.00")]
    [InlineData("-10000000000000000.00")]
    public void Balance_rejects_values_beyond_numeric_18_2(string text)
    {
        Assert.Throws<DomainException>(() => MoneyRules.EnsureValidBalance(TestData.Amount(text)));
    }
}

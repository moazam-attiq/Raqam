using FluentValidation;

namespace Raqam.Application.Dashboard;

public class DashboardSummaryQueryValidator : AbstractValidator<DashboardSummaryQuery>
{
    public DashboardSummaryQueryValidator()
    {
        RuleFor(x => x.From)
            .Must(from => from != default)
            .WithMessage("'From' is required.");

        RuleFor(x => x.From)
            .Must(from => from >= DashboardSummaryQuery.MinDate)
            .When(x => x.From != default)
            .WithMessage("'From' cannot be before 2000-01-01.");

        RuleFor(x => x.To)
            .Must(to => to != default)
            .WithMessage("'To' is required.");

        RuleFor(x => x.To)
            .Must((query, to) => to >= query.From)
            .When(x => x.From != default && x.To != default)
            .WithMessage("'To' cannot be before 'From'.");

        RuleFor(x => x.To)
            .Must((query, to) => to.DayNumber - query.From.DayNumber < DashboardSummaryQuery.MaxDays)
            .When(x => x.From != default && x.To >= x.From)
            .WithMessage($"The period cannot be longer than {DashboardSummaryQuery.MaxDays} days.");
    }
}

public class MonthlyQueryValidator : AbstractValidator<MonthlyQuery>
{
    public MonthlyQueryValidator()
    {
        RuleFor(x => x.Months).InclusiveBetween(1, MonthlyQuery.MaxMonths);

        RuleFor(x => x.To)
            .Must(to => to >= DashboardSummaryQuery.MinDate)
            .When(x => x.To.HasValue)
            .WithMessage("'To' cannot be before 2000-01-01.");
    }
}

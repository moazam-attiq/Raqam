using FluentValidation;
using Raqam.Application.Common;
using Raqam.Domain.Budgets;

namespace Raqam.Application.Budgets;

public class CreateBudgetRequestValidator : AbstractValidator<CreateBudgetRequest>
{
    public CreateBudgetRequestValidator()
    {
        RuleFor(x => x.Year).InclusiveBetween(Budget.MinYear, Budget.MaxYear);
        RuleFor(x => x.Month).InclusiveBetween(1, 12);
        RuleFor(x => x.Amount).PositiveAmount();
        RuleFor(x => x.CategoryId).NotEqual(Guid.Empty).When(x => x.CategoryId.HasValue);
    }
}

public class UpdateBudgetRequestValidator : AbstractValidator<UpdateBudgetRequest>
{
    public UpdateBudgetRequestValidator()
    {
        RuleFor(x => x.Amount).PositiveAmount();
    }
}

public class BudgetQueryValidator : AbstractValidator<BudgetQuery>
{
    public BudgetQueryValidator()
    {
        RuleFor(x => x.Year).InclusiveBetween(Budget.MinYear, Budget.MaxYear);
        RuleFor(x => x.Month).InclusiveBetween(1, 12);
    }
}

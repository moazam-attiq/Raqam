using FluentValidation;
using Raqam.Application.Common;
using Raqam.Domain.Transactions;

namespace Raqam.Application.Transactions;

public class CreateTransactionRequestValidator : AbstractValidator<CreateTransactionRequest>
{
    public CreateTransactionRequestValidator()
    {
        RuleFor(x => x.Type).NotNull().IsInEnum();
        RuleFor(x => x.Amount).PositiveAmount();
        RuleFor(x => x.TransactionDate).NotEqual(default(DateOnly)).WithMessage("'Transaction Date' is required.");
        RuleFor(x => x.SourceAccountId).NotEmpty();
        RuleFor(x => x.DestinationAccountId).NotEqual(Guid.Empty).When(x => x.DestinationAccountId.HasValue);
        RuleFor(x => x.CategoryId).NotEqual(Guid.Empty).When(x => x.CategoryId.HasValue);
        RuleFor(x => x.Description).MaximumLength(Transaction.DescriptionMaxLength);
        RuleFor(x => x.Merchant).MaximumLength(Transaction.MerchantMaxLength);
    }
}

public class UpdateTransactionRequestValidator : AbstractValidator<UpdateTransactionRequest>
{
    public UpdateTransactionRequestValidator()
    {
        RuleFor(x => x.Type).NotNull().IsInEnum();
        RuleFor(x => x.Amount).PositiveAmount();
        RuleFor(x => x.TransactionDate).NotEqual(default(DateOnly)).WithMessage("'Transaction Date' is required.");
        RuleFor(x => x.SourceAccountId).NotEmpty();
        RuleFor(x => x.DestinationAccountId).NotEqual(Guid.Empty).When(x => x.DestinationAccountId.HasValue);
        RuleFor(x => x.CategoryId).NotEqual(Guid.Empty).When(x => x.CategoryId.HasValue);
        RuleFor(x => x.Description).MaximumLength(Transaction.DescriptionMaxLength);
        RuleFor(x => x.Merchant).MaximumLength(Transaction.MerchantMaxLength);
    }
}

public class TransactionQueryValidator : AbstractValidator<TransactionQuery>
{
    public TransactionQueryValidator()
    {
        RuleFor(x => x.To)
            .Must((query, to) => to >= query.From)
            .When(x => x.From.HasValue && x.To.HasValue)
            .WithMessage("'To' cannot be before 'From'.");

        RuleFor(x => x.Type).IsInEnum().When(x => x.Type.HasValue);
        RuleFor(x => x.Sort).IsInEnum().When(x => x.Sort.HasValue);
        RuleFor(x => x.AccountId).NotEqual(Guid.Empty).When(x => x.AccountId.HasValue);
        RuleFor(x => x.CategoryId).NotEqual(Guid.Empty).When(x => x.CategoryId.HasValue);
        RuleFor(x => x.Search).MaximumLength(TransactionQuery.SearchMaxLength);
        RuleFor(x => x.Page).GreaterThanOrEqualTo(1);
        RuleFor(x => x.PageSize).InclusiveBetween(1, TransactionQuery.MaxPageSize);
    }
}

using FluentValidation;
using Raqam.Application.Common;
using Raqam.Domain.Accounts;

namespace Raqam.Application.Accounts;

public class CreateAccountRequestValidator : AbstractValidator<CreateAccountRequest>
{
    public CreateAccountRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(Account.NameMaxLength);
        RuleFor(x => x.AccountType).NotNull().IsInEnum();
        RuleFor(x => x.OpeningBalance).ValidBalance();
        RuleFor(x => x.InstitutionName).MaximumLength(Account.InstitutionNameMaxLength);
    }
}

public class UpdateAccountRequestValidator : AbstractValidator<UpdateAccountRequest>
{
    public UpdateAccountRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(Account.NameMaxLength);
        RuleFor(x => x.AccountType).NotNull().IsInEnum();
        RuleFor(x => x.OpeningBalance).ValidBalance();
        RuleFor(x => x.InstitutionName).MaximumLength(Account.InstitutionNameMaxLength);
    }
}

using FluentValidation;
using Raqam.Domain.Categories;

namespace Raqam.Application.Categories;

public class CreateCategoryRequestValidator : AbstractValidator<CreateCategoryRequest>
{
    public CreateCategoryRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(Category.NameMaxLength);
        RuleFor(x => x.Type).NotNull().IsInEnum();
        RuleFor(x => x.ParentCategoryId).NotEqual(Guid.Empty);
        RuleFor(x => x.Colour).MaximumLength(Category.ColourMaxLength);
        RuleFor(x => x.Icon).MaximumLength(Category.IconMaxLength);
    }
}

public class UpdateCategoryRequestValidator : AbstractValidator<UpdateCategoryRequest>
{
    public UpdateCategoryRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(Category.NameMaxLength);
        RuleFor(x => x.Colour).MaximumLength(Category.ColourMaxLength);
        RuleFor(x => x.Icon).MaximumLength(Category.IconMaxLength);
    }
}

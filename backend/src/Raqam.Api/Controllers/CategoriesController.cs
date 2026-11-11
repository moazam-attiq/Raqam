using Microsoft.AspNetCore.Mvc;
using Raqam.Application.Categories;
using Raqam.Domain.Categories;

namespace Raqam.Api.Controllers;

[ApiController]
[Route("api/v1/categories")]
public class CategoriesController(CategoryService categories) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CategoryResponse>>> List(
        [FromQuery] bool includeArchived, [FromQuery] CategoryType? type, CancellationToken cancellationToken) =>
        Ok(await categories.ListAsync(includeArchived, type, cancellationToken));

    [HttpPost]
    public async Task<ActionResult<CategoryResponse>> Create(
        CreateCategoryRequest request, CancellationToken cancellationToken)
    {
        var category = await categories.CreateAsync(request, cancellationToken);
        return CreatedAtAction(nameof(Get), new { id = category.Id }, category);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CategoryResponse>> Get(Guid id, CancellationToken cancellationToken) =>
        Ok(await categories.GetAsync(id, cancellationToken));

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<CategoryResponse>> Update(
        Guid id, UpdateCategoryRequest request, CancellationToken cancellationToken) =>
        Ok(await categories.UpdateAsync(id, request, cancellationToken));

    /// <summary>Archives the category and, for a top-level one, its subcategories (D028).</summary>
    [HttpPost("{id:guid}/archive")]
    public async Task<ActionResult<CategoryResponse>> Archive(Guid id, CancellationToken cancellationToken) =>
        Ok(await categories.ArchiveAsync(id, cancellationToken));
}

namespace Raqam.Application.Common;

/// <summary>One page of a list, with the totals a client needs to draw paging controls.</summary>
public sealed record PagedResult<T>(
    IReadOnlyList<T> Items,
    int Page,
    int PageSize,
    int TotalCount,
    int TotalPages)
{
    public static PagedResult<T> Create(IReadOnlyList<T> items, int page, int pageSize, int totalCount) =>
        new(items, page, pageSize, totalCount, (int)Math.Ceiling(totalCount / (double)pageSize));
}

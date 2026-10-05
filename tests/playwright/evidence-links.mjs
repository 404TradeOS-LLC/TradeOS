export function firstDetailHref(candidates, prefix) {
  return candidates.find((href) => {
    if (!href.startsWith(prefix)) return false;
    const detailId = href.slice(prefix.length);
    return Boolean(detailId) && detailId !== "new" && !detailId.includes("/");
  });
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronLeft, ChevronRight, PackageSearch, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/shared/page-header";
import { ProductCard } from "@/components/catalog/product-card";
import { ProductCardSkeleton } from "@/components/catalog/product-card-skeleton";
import { usePublicProducts } from "@/lib/hooks/use-catalog";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { PublicProduct } from "@/lib/types";

const PAGE_SIZE = 20;

type SortOption = "featured" | "price-asc" | "price-desc" | "rating-desc";

const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "rating-desc", label: "Rating: High to Low" },
];

function sortProducts(products: PublicProduct[], sort: SortOption): PublicProduct[] {
  const sorted = [...products];
  switch (sort) {
    case "price-asc":
      return sorted.sort((a, b) => a.price_scraped - b.price_scraped);
    case "price-desc":
      return sorted.sort((a, b) => b.price_scraped - a.price_scraped);
    case "rating-desc":
      return sorted.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
    default:
      return sorted;
  }
}

export default function CatalogPage() {
  const user = useAuthStore((s) => s.user);
  const { data, isLoading, isError, refetch, isFetching } = usePublicProducts(1000);

  const [search, setSearch] = useState("");
  const [portal, setPortal] = useState("all");
  const [sort, setSort] = useState<SortOption>("featured");
  const [page, setPage] = useState(1);

  const allProducts = useMemo(() => data?.products ?? [], [data]);

  const portals = useMemo(() => {
    const set = new Set<string>();
    allProducts.forEach((p) => p.portal && set.add(p.portal));
    return Array.from(set).sort();
  }, [allProducts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = allProducts;
    if (portal !== "all") rows = rows.filter((p) => p.portal === portal);
    if (q) {
      rows = rows.filter((p) => `${p.title} ${p.seller ?? ""}`.toLowerCase().includes(q));
    }
    return sortProducts(rows, sort);
  }, [allProducts, search, portal, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function updateFilter(fn: () => void) {
    fn();
    setPage(1);
  }

  return (
    <div>
      <PageHeader title="Product Catalog" description="Browse every product currently tracked across our marketplace partners." />

      {!user && (
        <Alert className="mb-4">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>Sign in to access the full MOP tracker dashboard and internal tools.</span>
            <Button asChild size="sm" variant="outline">
              <Link href="/login">Sign in</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => updateFilter(() => setSearch(e.target.value))}
            placeholder="Search products or sellers…"
            className="pl-8"
          />
        </div>
        <Select value={portal} onValueChange={(v) => updateFilter(() => setPortal(v))}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Portals</SelectItem>
            {portals.map((p) => (
              <SelectItem key={p} value={p} className="capitalize">
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => updateFilter(() => setSort(v as SortOption))}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!isLoading && !isError && (
        <p className="mb-3 text-sm text-muted-foreground">
          {filtered.length} product{filtered.length === 1 ? "" : "s"} found
        </p>
      )}

      {isError ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-20 text-center">
          <AlertTriangle className="size-8 text-destructive" />
          <p className="font-medium">Could not load products — please try again.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            Retry
          </Button>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-20 text-center">
          <PackageSearch className="size-8 text-muted-foreground" />
          <p className="font-medium">No products match your search</p>
          <p className="text-sm text-muted-foreground">Try a different search term or filter.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {pageItems.map((product, idx) => (
              <ProductCard key={`${product.portal}-${product.product_url ?? product.title}-${idx}`} product={product} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
              >
                <ChevronLeft className="size-4" />
                Prev
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
              >
                Next
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

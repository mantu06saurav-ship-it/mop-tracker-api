"use client";

import { useState } from "react";
import { ExternalLink, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BoolBadge } from "@/components/shared/status-badge";
import { formatINR } from "@/lib/format";
import type { PublicProduct } from "@/lib/types";

function portalLabel(portal: string): string {
  return portal.charAt(0).toUpperCase() + portal.slice(1);
}

export function ProductCard({ product }: { product: PublicProduct }) {
  const [imgError, setImgError] = useState(false);

  const hasDiscount = product.mrp != null && product.mrp > product.price_scraped;
  const discountPct = hasDiscount
    ? Math.round(((product.mrp as number) - product.price_scraped) / (product.mrp as number) * 100)
    : null;

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md">
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        {product.image_url && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={product.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-5xl" aria-hidden>
            👟
          </div>
        )}
        <Badge variant="secondary" className="absolute left-2 top-2 capitalize shadow-sm">
          {product.portal}
        </Badge>
        {discountPct !== null && discountPct > 0 && (
          <Badge variant="destructive" className="absolute right-2 top-2 bg-destructive text-white shadow-sm">
            {discountPct}% OFF
          </Badge>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-snug">{product.title}</p>
        <p className="text-xs text-muted-foreground">Sold by {product.seller || "—"}</p>

        {product.rating != null && (
          <div className="flex items-center gap-1 text-xs">
            <Star className="size-3.5 fill-warning text-warning" />
            <span className="font-medium">{product.rating.toFixed(1)}</span>
            {product.reviews && <span className="text-muted-foreground">({product.reviews})</span>}
          </div>
        )}

        <BoolBadge ok={/in stock/i.test(product.inventory_status ?? "")} okLabel="In Stock" badLabel="Out of Stock" />

        <div className="mt-auto flex items-baseline gap-2 pt-1">
          <span className="text-lg font-semibold tabular-nums">{formatINR(product.price_scraped)}</span>
          {hasDiscount && (
            <span className="text-xs text-muted-foreground line-through">{formatINR(product.mrp)}</span>
          )}
        </div>

        {product.product_url && (
          <Button asChild variant="outline" size="sm" className="mt-1 w-full">
            <a href={product.product_url} target="_blank" rel="noopener noreferrer">
              View on {portalLabel(product.portal)}
              <ExternalLink className="size-3.5" />
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSellerMapping, useToggleSellerMappingEmail } from "@/lib/hooks/use-seller-mapping";

export function SellerMappingTable() {
  const { data, isLoading } = useSellerMapping();
  const toggleMutation = useToggleSellerMappingEmail();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const rows = data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => `${r.seller} ${r.portal}`.toLowerCase().includes(q));
  }, [data, search]);

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Seller / Portal Email Inclusion</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Toggling off excludes that seller+portal&apos;s MOP data from the daily email snapshot only — it&apos;s
          still shown everywhere else in the app. New/unmapped sellers are always included by default.
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search seller or portal…"
          className="pl-8"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
          No seller mappings match your search.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Seller</TableHead>
                <TableHead>Portal</TableHead>
                <TableHead>Vertical Head</TableHead>
                <TableHead>KAM</TableHead>
                <TableHead className="text-right">Include in Email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.seller}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{row.portal}</TableCell>
                  <TableCell className="text-muted-foreground">{row.vertical_head || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{row.kam || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Switch
                      checked={row.email_active}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ id: row.id, emailActive: checked })
                      }
                      aria-label={`Toggle email inclusion for ${row.seller} on ${row.portal}`}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

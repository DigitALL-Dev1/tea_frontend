import { FileText, FileSpreadsheet } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPngShort } from "@/lib/deadline";
import type { Tender, TenderDocument } from "@/types";
import { HashChip, Pill } from "../badges";

const SOURCE: Record<TenderDocument["source"], string> = {
  UNGM_NOTICE: "UNGM notice",
  UNGM_ALERT: "UNGM alert email",
  AMENDMENT: "Amendment",
  CLARIFICATION: "Clarification",
  INTERNAL: "GREEN (internal)",
  SUPPLIER: "Supplier",
};

export function DocumentsTab({ tender: t }: { tender: Tender }) {
  const docs = [...t.documents].sort((a, b) => a.addedAt.localeCompare(b.addedAt));
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow>
              <TableHead>File name</TableHead>
              <TableHead>SHA-256</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Part of</TableHead>
              <TableHead>Date (PNG)</TableHead>
              <TableHead className="text-right">Size</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {docs.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">
                  <span className="flex items-center gap-2">
                    {d.fileName.endsWith(".xlsx") ? (
                      <FileSpreadsheet className="size-4 shrink-0 text-status-green" />
                    ) : (
                      <FileText className="size-4 shrink-0 text-status-red" />
                    )}
                    {d.fileName}
                  </span>
                </TableCell>
                <TableCell>
                  <HashChip hash={d.sha256} />
                </TableCell>
                <TableCell className="text-sm">{SOURCE[d.source]}</TableCell>
                <TableCell>
                  {d.scope === "TENDER" ? (
                    <Pill tone="slate">Tender documents</Pill>
                  ) : (
                    <Pill tone="green">Our package</Pill>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm tabular-nums">
                  {formatPngShort(d.addedAt)}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {d.sizeKb.toLocaleString()} KB
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

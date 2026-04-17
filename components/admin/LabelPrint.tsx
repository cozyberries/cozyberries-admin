"use client";

import { useEffect } from "react";
import type { PackingSlipRawPackage } from "@/lib/delhivery/types";

/**
 * Parse Delhivery product string into an array.
 * Handles two formats:
 *  1. "Name(qty)~Name(qty)" — standard Delhivery format
 *  2. "Name, Name, Name"    — legacy comma-separated (no qty)
 */
function parseProducts(prd: string): Array<{ name: string; qty: number }> {
  if (!prd?.trim()) return [];

  // Format 1: tilde-separated with qty in parens
  if (prd.includes("~") || /\(\d+\)/.test(prd)) {
    const results = prd
      .split("~")
      .map((entry) => {
        const match = entry.trim().match(/^(.+)\((\d+)\)$/);
        if (match) return { name: match[1].trim(), qty: parseInt(match[2], 10) };
        // entry without qty (e.g. orphaned after split)
        const name = entry.trim();
        return name ? { name, qty: 1 } : null;
      })
      .filter(Boolean) as Array<{ name: string; qty: number }>;
    if (results.length) return results;
  }

  // Format 2: comma-separated (no qty info)
  return prd
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((name) => ({ name, qty: 1 }));
}

/** "2026-03-07T12:17:11.139" → "07-Mar-2026" */
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const day = String(d.getDate()).padStart(2, "0");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

type LabelPrintProps = { pkg: PackingSlipRawPackage; autoPrint?: boolean };

export default function LabelPrint({ pkg, autoPrint = false }: LabelPrintProps) {
  const products = parseProducts(pkg.prd ?? "");
  const displayProducts = products.slice(0, 2);
  const extraCount = products.length - displayProducts.length;
  const totalQty = parseInt(pkg.qty, 10) || products.reduce((s, p) => s + p.qty, 0);
  const motLabel = pkg.mot === "S" ? "Surface" : pkg.mot === "E" ? "Express" : pkg.mot ?? "";
  const name = pkg.name?.trim() || "—";
  const address = pkg.address?.trim() || "—";
  const destination = pkg.destination?.trim() || "—";
  const seller = pkg.snm?.trim() || "Cozyberries";
  const orderId = pkg.oid?.trim() || "—";
  const paymentType = pkg.pt?.trim() || "—";
  const sortCode = pkg.sort_code?.trim() || "—";

  useEffect(() => {
    const shouldAutoPrint =
      autoPrint ||
      (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("autoPrint") === "true");
    if (!shouldAutoPrint) return;
    const t = setTimeout(() => window.print(), 700);
    return () => clearTimeout(t);
  }, [autoPrint]);

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        html, body {
          font-family: 'Roboto', Arial, sans-serif;
          background: #e8e8e8;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding: 24px;
          min-height: 100vh;
        }

        .label {
          background: #fff;
          width: 384px;
          min-height: 576px;
          border: 2px solid #222;
          display: flex;
          flex-direction: column;
          padding: 10px;
          overflow: hidden;
        }
        .label-inner {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
          overflow: hidden;
          border: 1px solid #ccc;
        }

        /* ── Header ─── */
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 10px;
          border-bottom: 1.5px solid #222;
          min-height: 52px;
        }
        .header img.cl-logo,
        .header img.dlv-logo {
          height: 64px;
          width: auto;
          max-height: 64px;
          object-fit: contain;
          display: block;
        }
        .header img.cl-logo {
          max-width: 160px;
        }
        .header img.dlv-logo {
          max-width: 160px;
        }

        /* ── Barcode section ─── */
        .barcode-section {
          padding: 8px 10px 4px;
          border-bottom: 1.5px solid #222;
        }
        .barcode-img {
          width: 100%;
          height: 88px;
          object-fit: fill;
          display: block;
        }
        .barcode-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 10px;
          font-size: 11.5px;
          font-weight: 600;
        }
        .barcode-meta .sort {
          font-weight: 800;
          letter-spacing: 0.5px;
        }

        /* ── Ship To section ─── */
        .shipto-section {
          border-bottom: 1.5px solid #222;
          min-height: 90px;
        }
        .shipto-left {
          padding: 8px 10px;
        }
        .shipto-label {
          font-size: 10px;
          font-weight: 500;
          color: #444;
          margin-bottom: 1px;
        }
        .shipto-name {
          font-size: 17px;
          font-weight: 900;
          color: #000;
          line-height: 1.15;
          margin-bottom: 4px;
          word-break: break-word;
          overflow-wrap: break-word;
        }
        .shipto-address {
          font-size: 13.5px;
          font-weight: 500;
          color: #111;
          line-height: 1.5;
          word-break: break-word;
          overflow-wrap: break-word;
        }
        .shipto-dest {
          font-size: 14px;
          font-weight: 700;
          color: #000;
          margin-top: 3px;
          line-height: 1.3;
          word-break: break-word;
          overflow-wrap: break-word;
        }
        .shipto-pin {
          font-size: 15px;
          font-weight: 900;
          color: #000;
          margin-top: 2px;
        }
        .payment-type {
          font-size: 13px;
          font-weight: 700;
          color: #000;
        }
        .date-block {
          font-size: 10px;
          color: #333;
          line-height: 1.4;
        }
        .date-block .date-label {
          font-weight: 700;
          font-size: 10px;
          margin-right: 4px;
        }

        /* ── Seller + Payment/Date ─── */
        .seller-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          border-bottom: 1.5px solid #222;
          min-height: 52px;
        }
        .seller-left {
          padding: 6px 10px;
          border-right: 1.5px solid #222;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 2px;
        }
        .seller-text {
          font-size: 11.5px;
          font-weight: 500;
          color: #111;
        }
        .seller-text strong {
          font-weight: 800;
        }
        .seller-oid {
          font-size: 9px;
          font-weight: 600;
          color: #333;
          letter-spacing: 0.2px;
          word-break: break-all;
        }
        .seller-right {
          padding: 8px 10px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 4px;
        }

        /* ── Products table ─── */
        .products-section {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          border-bottom: 1.5px solid #222;
        }
        .products-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
        }
        .products-table thead tr {
          border-bottom: 1.5px solid #222;
          background: #f5f5f5;
        }
        .products-table thead th {
          padding: 4px 8px;
          text-align: left;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          color: #222;
        }
        .products-table thead th.right { text-align: right; }
        .products-table tbody td {
          padding: 4px 8px;
          vertical-align: top;
          font-size: 11px;
          color: #111;
        }
        .products-table tbody td.right { text-align: right; }
        .products-table tbody tr + tr td {
          border-top: 1px solid #e0e0e0;
        }
        .product-name {
          font-weight: 500;
          line-height: 1.35;
          word-break: break-word;
          overflow-wrap: break-word;
          max-width: 100%;
        }

        /* ── Footer ─── */
        .footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 5px 10px;
          border-top: 1px solid #ddd;
        }
        .footer-more {
          font-size: 10.5px;
          color: #555;
          font-weight: 500;
        }
        .footer-total {
          font-size: 10.5px;
          color: #333;
          font-weight: 600;
          text-align: right;
        }
        .footer-page {
          font-size: 10px;
          color: #888;
        }

        /* ── Print button ─── */
        .no-print {
          position: fixed;
          top: 14px;
          right: 14px;
          z-index: 100;
          display: flex;
          gap: 8px;
        }
        .btn-print {
          background: #000;
          color: #fff;
          border: none;
          padding: 8px 16px;
          border-radius: 5px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 700;
          font-family: inherit;
        }
        .btn-close {
          background: #e5e7eb;
          color: #374151;
          border: none;
          padding: 8px 16px;
          border-radius: 5px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          font-family: inherit;
        }

        /* ── Print styles ─── */
        @media print {
          @page {
            size: 4in 6in;
            margin: 0;
          }
          html, body {
            background: white;
            padding: 0;
            margin: 0;
            display: block;
            height: 6in;
          }
          .no-print { display: none !important; }
          .label {
            width: 4in;
            height: 6in;
            max-height: 6in;
            padding: 0.08in;
            border: 1px solid #000;
            page-break-after: avoid;
            overflow: hidden;
            box-sizing: border-box;
          }
          .label-inner {
            border: 1px solid #999;
            height: 100%;
            min-height: 0;
            overflow: hidden;
            box-sizing: border-box;
          }
          .products-section {
            flex: 1;
            min-height: 0;
            overflow: hidden;
          }
        }
      `}</style>

      {/* Print / Close buttons */}
      <div className="no-print">
        <button className="btn-print" onClick={() => window.print()}>Print Label</button>
        <button className="btn-close" onClick={() => window.close()}>Close</button>
      </div>

      <div className="label">
        <div className="label-inner">

        {/* ── Header ─────────────────────────────────── */}
        <div className="header">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="cl-logo"
            src="/logo-black.png"
            alt="Cozyberries"
            onError={(e) => {
              const el = e.target as HTMLImageElement;
              el.onerror = null;
              el.src = pkg.cl_logo;
            }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="dlv-logo"
            src={pkg.delhivery_logo}
            alt="Delhivery"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>

        {/* ── Barcode ─────────────────────────────────── */}
        <div className="barcode-section">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="barcode-img" src={pkg.barcode} alt={`Barcode ${pkg.wbn}`} />
          <div className="barcode-meta">
            <span>{pkg.pin ?? "—"}</span>
            <span>AWB# {pkg.wbn ?? "—"}</span>
            <span className="sort">{sortCode}</span>
          </div>
        </div>

        {/* ── Ship To ──────────────────────────────────── */}
        <div className="shipto-section">
          <div className="shipto-left">
            <div className="shipto-label">Ship to</div>
            <div className="shipto-name">{name}</div>
            <div className="shipto-address">{address}</div>
            <div className="shipto-dest">{destination}</div>
            <div className="shipto-pin">PIN - {pkg.pin ?? "—"}</div>
          </div>
        </div>

        {/* ── Seller + Payment/Date ────────────────────── */}
        <div className="seller-section">
          <div className="seller-left">
            <div className="seller-text">
              Seller:<strong> {seller}</strong>
            </div>
            <div className="seller-oid">{orderId}</div>
          </div>
          <div className="seller-right">
            <div className="payment-type">
              {paymentType}{motLabel ? ` - ${motLabel}` : ""}
            </div>
            <div className="date-block">
              <span className="date-label">Date </span>
              <span>{formatDate(pkg.cd)}</span>
            </div>
          </div>
        </div>

        {/* ── Products ─────────────────────────────────── */}
        <div className="products-section">
          <table className="products-table">
            <thead>
              <tr>
                <th>Product Name</th>
                <th className="right">Qty.</th>
              </tr>
            </thead>
            <tbody>
              {displayProducts.map((p, i) => (
                <tr key={i}>
                  <td><div className="product-name">{p.name}</div></td>
                  <td className="right">{p.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Footer ───────────────────────────────────── */}
        <div className="footer">
          {extraCount > 0 ? (
            <div className="footer-more">+ {extraCount} more SKU{extraCount > 1 ? "s" : ""}</div>
          ) : (
            <div />
          )}
          <div className="footer-total">{totalQty} item{totalQty !== 1 ? "s" : ""} in total</div>
          <div className="footer-page">Page 1 of 1</div>
        </div>

        </div>
      </div>
    </>
  );
}

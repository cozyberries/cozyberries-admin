export function buildUpiUrl({
    upiId,
    name,
    amount,
    note,
  }: {
    upiId: string;
    name: string;
    amount?: number;
    note?: string;
  }) {
    const params = new URLSearchParams({
      pa: upiId,
      pn: name,
      cu: 'INR',
    });
    if (amount) params.append('am', amount.toString());
    if (note) params.append('tn', note);
    return `upi://pay?${params.toString()}`;
  }
  
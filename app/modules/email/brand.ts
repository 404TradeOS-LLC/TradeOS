/** Platform-generated security/invitation mail only; never overrides contractor document brands. */
export function renderTradeOsEmail(content: string): string {
  return [
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>',
    '<body style="margin:0;background:#f3f3f1;color:#202225;font-family:Arial,Helvetica,sans-serif">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f3f1"><tr><td align="center" style="padding:32px 16px">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #deded9">',
    '<tr><td style="padding:28px 32px;background:#202225;color:#ffffff"><strong style="font-size:26px;letter-spacing:-0.7px">Trade<span style="color:#C98460">OS</span></strong><div style="margin-top:8px;font-size:11px;letter-spacing:2px;color:#e4b396">BUILT FOR WHAT YOU BUILD.</div></td></tr>',
    '<tr><td style="padding:28px 32px;font-size:16px;line-height:1.65">',
    content,
    '</td></tr><tr><td style="border-top:1px solid #deded9;padding:18px 32px;font-size:12px;line-height:1.6;color:#60605e">This is an automated TradeOS message. Do not share private sign-in or access links.</td></tr>',
    '</table></td></tr></table></body></html>',
  ].join("");
}

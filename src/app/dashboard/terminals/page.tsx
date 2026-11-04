'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { listTerminalFleet, updateTerminalFleet, type TerminalFleetEntry, type TerminalFleetMetadata } from '@/lib/api';

type Draft = Pick<TerminalFleetMetadata, 'revision' | 'serial_number' | 'did' | 'shva_terminal_id' | 'supplier_id' | 'acquirer' | 'lifecycle'>;
const states = { in_service: 'In service', repair: 'Under repair', returned: 'Returned', quarantine: 'Quarantined' };
const fields = [ ['serial_number', 'Serial number'], ['did', 'DID / requested VHQ device ID'], ['shva_terminal_id', 'SHVA terminal number'], ['supplier_id', 'Supplier / merchant number'], ['acquirer', 'Acquirer / supplier'] ] as const;

/** Platform-wide device visibility, kept separate from banking configuration. */
export default function TerminalFleetPage() {
  const [rows, setRows] = useState<TerminalFleetEntry[]>([]);
  const [query, setQuery] = useState('');
  const [restaurant, setRestaurant] = useState('');
  const [applied, setApplied] = useState({q:'', restaurant_id:''});
  const [offset, setOffset] = useState(0);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<TerminalFleetEntry | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const generation = useRef(0);
  const load = useCallback(async () => {
    const request = ++generation.current; setLoading(true);setError('');
    try { const result = await listTerminalFleet({...applied,offset});if(request!==generation.current)return;setRows(result.terminals);setMore(result.has_more); }
    catch { if(request===generation.current)setError('Could not load terminals. Retry without changing device or bank settings.'); }
    finally { if(request===generation.current)setLoading(false); }
  },[applied,offset]);
  useEffect(()=>{const current = generation; void load();return()=>{current.current++;};},[load]);
  function edit(row:TerminalFleetEntry){
    setEditing(row);setSaveError('');setDraft({revision:row.metadata?.revision??0,serial_number:row.metadata?.serial_number??'',did:row.metadata?.did??'',shva_terminal_id:row.metadata?.shva_terminal_id??'',supplier_id:row.metadata?.supplier_id??'',acquirer:row.metadata?.acquirer??'',lifecycle:row.metadata?.lifecycle??'in_service'});
  }
  async function save(){
    if(!editing||!draft||saving)return;setSaving(true);setSaveError('');
    try{await updateTerminalFleet(editing.device_id,draft);setEditing(null);setDraft(null);await load();}
    catch{setSaveError('Could not save declarations. Another operator may have changed this terminal. Your input is retained; close and reload before trying again.');}
    finally{setSaving(false);}
  }
  return <section className="min-w-0 space-y-6">
    <div><h1 className="text-2xl font-semibold text-gray-900">Terminal fleet</h1><p className="mt-2 text-sm text-gray-600">Payment-capable devices across all restaurants, including devices retained for support history.</p></div>
    <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700">Serial, DID, SHVA and supplier values saved here are <strong>declarations, not applied bank parameters</strong>. Saving never transmits, deposits, erases, reassigns a terminal or changes a payment provider. Remote bank provisioning still needs Verifone&apos;s regional procedure.</div>
    <form className="flex flex-wrap items-end gap-3" onSubmit={e=>{e.preventDefault();setOffset(0);setApplied({q:query,restaurant_id:restaurant});}}>
      <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">Search name, model or declared identifier<input className="rounded-lg border border-gray-300 px-3 py-2" value={query} maxLength={100} onChange={e=>setQuery(e.target.value)}/></label>
      <label className="flex flex-col gap-1 text-sm">Restaurant ID<input className="w-36 rounded-lg border border-gray-300 px-3 py-2" inputMode="numeric" pattern="[0-9]*" value={restaurant} onChange={e=>setRestaurant(e.target.value)}/></label>
      <button className="rounded-full bg-gray-900 px-5 py-2 text-white" type="submit">Search</button>
      <button className="rounded-full border border-gray-300 px-5 py-2" type="button" disabled={loading} onClick={()=>void load()}>Refresh</button>
    </form>
    {error&&<div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>}
    {loading?<p role="status">Loading terminals…</p>:!error&&<div className="overflow-x-auto rounded-xl border border-gray-200 bg-white"><table className="w-full text-left text-sm"><thead className="border-b bg-gray-50"><tr>{['Restaurant / device','Hardware','Serial','DID','SHVA terminal','Supplier','Lifecycle / connection',''].map((label,i)=><th key={i} className="whitespace-nowrap p-3 font-medium">{label}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.device_id} className="border-b last:border-b-0">
      <td className="p-3"><div className="font-medium">{row.name}</div><div>{row.restaurant_name} · {row.restaurant_id}</div><div className="mt-1 break-all text-xs text-gray-500">{row.device_id}</div></td>
      <td className="p-3">{[row.manufacturer,row.model].filter(Boolean).join(' ')||'—'}</td>
      <td className="p-3">{row.metadata?.serial_number||'Not declared'}</td><td className="p-3">{row.metadata?.did||'—'}</td><td className="p-3">{row.metadata?.shva_terminal_id||'—'}</td>
      <td className="p-3"><div>{row.metadata?.supplier_id||'—'}</div><div className="text-gray-500">{row.metadata?.acquirer}</div></td>
      <td className="p-3"><div>{row.metadata?states[row.metadata.lifecycle]:'Not declared'}</div><div className="text-gray-500">{row.forgotten_at?'Forgotten in restaurant inventory':row.status}</div>{row.last_seen_at&&<time className="block text-xs text-gray-500">{new Date(row.last_seen_at).toLocaleString()}</time>}</td>
      <td className="p-3"><button className="whitespace-nowrap rounded-full border border-gray-300 px-4 py-2" onClick={()=>edit(row)}>Edit declarations</button></td>
    </tr>)}{rows.length===0&&<tr><td colSpan={8} className="p-6 text-center text-gray-600">No payment terminals match these filters.</td></tr>}</tbody></table></div>}
    <div className="flex gap-3"><button className="rounded-full border px-4 py-2 disabled:opacity-40" disabled={loading||offset===0} onClick={()=>setOffset(x=>Math.max(0,x-100))}>Previous</button><button className="rounded-full border px-4 py-2 disabled:opacity-40" disabled={loading||!more} onClick={()=>setOffset(x=>x+100)}>Next</button></div>
    {editing&&draft&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div role="dialog" aria-modal="true" aria-labelledby="fleet-edit-title" className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"><h2 id="fleet-edit-title" className="text-xl font-semibold">Edit declarations · {editing.name}</h2><p className="mt-2 text-sm text-gray-600">These values remain marked “declared, not applied”. Device assignment and banking configuration are unchanged.</p><form className="mt-5 space-y-4" onSubmit={e=>{e.preventDefault();void save();}}>{fields.map(([key,label])=><label key={key} className="block text-sm">{label}<input disabled={saving} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" maxLength={key==='shva_terminal_id'?10:80} pattern={key==='shva_terminal_id'?'[0-9]{10}':undefined} value={draft[key]} onChange={e=>setDraft({...draft,[key]:e.target.value})}/></label>)}<label className="block text-sm">Declared lifecycle<select disabled={saving} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" value={draft.lifecycle} onChange={e=>setDraft({...draft,lifecycle:e.target.value as Draft['lifecycle']})}>{Object.entries(states).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>{saveError&&<p role="alert" className="text-sm text-red-700">{saveError}</p>}<div className="flex justify-end gap-3 pt-2"><button type="button" disabled={saving} className="rounded-full border px-5 py-2" onClick={()=>{setEditing(null);setDraft(null);}}>Cancel</button><button disabled={saving} className="rounded-full bg-gray-900 px-5 py-2 text-white" type="submit">{saving?'Saving…':'Save declarations'}</button></div></form></div></div>}
  </section>;
}

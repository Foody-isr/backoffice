'use client';

import { useRef, useState } from 'react';
import { changeFoodyTrial, reconcileFoodyBilling, type FoodyModule, type FoodyPrivateBilling, type TrialAction } from '@/lib/api';

const button = 'rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium disabled:opacity-50';
const date = (value: string) => new Intl.DateTimeFormat('en-GB', {dateStyle:'long',timeZone:'Asia/Jerusalem'}).format(new Date(value));
const money = (minor:number) => new Intl.NumberFormat('en-IL',{style:'currency',currency:'ILS'}).format(minor / 100);
const states = {available: 'No scheduled trial', trial: 'Trial in progress', expired: 'Trial ended', paid: 'Paid subscription'};
const labels: Record<TrialAction,string> = {start:'Start a new trial',extend:'Extend trial',end:'End trial now',reset:'Reset sandbox billing'};

/** Manage trial dates and preserve the ledger when retiring a sandbox subscription. */
export default function FoodyBillingLifecycle({ rid, view, disabled, onChange, onReload }: {
  rid:number; view:FoodyPrivateBilling; disabled:boolean; onChange:(view:FoodyPrivateBilling)=>void; onReload:()=>Promise<void>;
}) {
  const [days,setDays]=useState('14');
  const [modules,setModules]=useState<FoodyModule[]>([]);
  const [confirm,setConfirm]=useState<TrialAction|null>(null);
  const [transactions,setTransactions]=useState<Record<number,string>>({});
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [working,setWorking]=useState(false);
  const lock=useRef(false);
  const state=view.lifecycle;
  if(!state) return null;
  const active=state.state==='trial';
  const action=active?'extend':'start';
  const duration=Number(days);
  const valid=Number.isSafeInteger(duration) && duration >= (active?1:14) && (!state.needs_trial_modules || modules.length>0);
  const blocked=disabled||working;

  async function submit(request:()=>Promise<FoodyPrivateBilling>,success:string) {
    if(lock.current) return;
    lock.current=true;setWorking(true);setError('');setMessage('');setConfirm(null);
    try {onChange(await request());setMessage(success);}
    catch(e) {
      const code=e instanceof Error ? e.message : '';
      setError(code==='foody_billing_conflict' ? 'The billing state changed. Reload before continuing.'
        : code==='foody_trial_scope_required' ? 'Select a catalogue module or plan to define the access included.'
        : 'The change could not be confirmed. Reload to check the current state.');
    } finally {lock.current=false;setWorking(false);}
  }

  function apply(chosen:TrialAction) {
    if(!state) return;
    const withDuration=chosen==='start'||chosen==='extend';
    void submit(()=>changeFoodyTrial(rid,{action:chosen, version:state.version, days:withDuration?duration:0,
      trial_modules:withDuration && state.needs_trial_modules?modules:undefined}),
      chosen==='reset'?'Sandbox billing reset. The owner can choose a public plan. Payment and invoice history is available.'
      : chosen==='end'?'Trial ended.':chosen==='extend'?'Trial extended.':'New trial started.');
  }

  return <div className="space-y-4 border-t border-gray-200 pt-4">
    <section aria-label="Trial management" className="space-y-3">
      <h3 className="font-semibold">Trial management</h3>
      <p className="text-sm text-gray-700">{states[state.state]}{state.trial_end && state.state!=='paid' ? ' · '+date(state.trial_end):''}</p>
      {state.can_manage && <div className="space-y-3">
        {state.needs_trial_modules && <fieldset><legend className="text-sm font-medium">Trial modules</legend>
          {view.onboarding?.catalog.products.map(p=><label key={p.id} className="me-4 inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={modules.includes(p.id)} onChange={e=>setModules(e.target.checked?[...modules,p.id]:modules.filter(m=>m!==p.id))}/>{p.name.en}</label>)}
        </fieldset>}
        <label className="block text-sm font-medium">{active?'Days to add':'New trial duration in days'}
          <input type="number" min={active?1:14} step={1} value={days} onChange={e=>setDays(e.target.value)}
            className="mt-1 block w-24 rounded-md border border-gray-300 px-3 py-2 text-sm"/></label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={button} disabled={blocked||!valid} onClick={()=>apply(action)}>{labels[action]}</button>
          {state.state!=='expired' && <button type="button" className={button} disabled={blocked} onClick={()=>setConfirm('end')}>{labels.end}</button>}
        </div>
      </div>}
      {state.can_reset && <button type="button" className={button} disabled={blocked} onClick={()=>setConfirm('reset')}>{labels.reset}</button>}
      {confirm && <div role="group" aria-label={labels[confirm]} className="space-y-3 rounded-lg bg-amber-50 p-4 text-sm">
        <p>{confirm==='reset'?'Retire the sandbox offer and stop its renewals? Trial dates, invoices and payments, including attempts awaiting review, are kept.'
          :'End trial access immediately? The owner can still open billing and choose the available offer.'}</p>
        <div className="flex gap-2"><button type="button" className={button} disabled={blocked} onClick={()=>apply(confirm)}>{labels[confirm]}</button>
          <button type="button" className={button} onClick={()=>setConfirm(null)}>Cancel</button></div>
      </div>}
    </section>
    {!!view.archived_reviews?.length && <section className="space-y-3"><h3 className="font-semibold">Archived payments awaiting verification</h3>
      {view.archived_reviews.map(p=><form className="space-y-2 text-sm" key={p.id} onSubmit={e=>{e.preventDefault();
        void submit(()=>reconcileFoodyBilling(rid,transactions[p.id]?.trim(),p.id),'Verification completed. Unresolved payments stay in this list.');}}>
        <p>{money(p.amount_minor)} · <bdi>{p.reference}</bdi></p>
        <label className="block">Matching Verifone Central transaction ID
          <input className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" required maxLength={36}
            value={transactions[p.id]??''} onChange={e=>setTransactions({...transactions,[p.id]:e.target.value})}/></label>
        <button className={button} disabled={blocked||!transactions[p.id]?.trim()}>Verify archived payment</button>
      </form>)}
    </section>}
    {message && <p role="status" className="text-sm text-green-800">{message}</p>}
    {error && <div role="alert" className="text-sm text-red-700">{error} <button className="underline" onClick={onReload}>Reload</button></div>}
  </div>;
}

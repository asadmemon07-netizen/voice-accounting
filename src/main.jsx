import React, {useEffect, useMemo, useState} from "react";
import {createRoot} from "react-dom/client";
import "./styles.css";

const KEY="voice_accounts_entries_v1";
const emptyForm={type:"Expense",accountHead:"",party:"",amount:"",description:"",date:new Date().toISOString().slice(0,10)};

function parseVoice(text){
  const t=text.toLowerCase().replace(/,/g,"");
  const nums=[...t.matchAll(/(?:rs\.?|pkr)?\s*(\d+(?:\.\d+)?)\s*(k|thousand|lac|lakh|million|m)?/gi)];
  let amount=nums.length?Number(nums[nums.length-1][1]):0;
  const unit=nums.length?(nums[nums.length-1][2]||""):"";
  if(/k|thousand/i.test(unit)) amount*=1000;
  if(/lac|lakh/i.test(unit)) amount*=100000;
  if(/million/i.test(unit)) amount*=1000000;
  let type="Expense";
  if(/receivable|receive|lena|lene hain|milega/.test(t)) type="Receivable";
  if(/payable|pay|dena hai|dene hain|daina|diye|paid|payment/.test(t)) type="Payable";
  if(/expense|kharcha|spent|kharche/.test(t)) type="Expense";
  if(/received|receive ho gaya|mil gaye|vasool/.test(t)) type="Receipt";
  const patterns=[/(?:to|ko|from|se)\s+([a-z][a-z0-9 .&'-]{1,40}?)(?=\s+(?:rs|pkr|\d)|\s*$)/i,/(?:for|from)\s+([a-z][a-z0-9 .&'-]{1,40}?)(?=\s+(?:rs|pkr|\d)|\s*$)/i];
  let party="";
  for(const r of patterns){const m=text.match(r);if(m){party=m[1].trim();break;}}
  if(!party){const stop=new Set(["ko","se","from","to","rs","pkr","expense","kharcha","payable","receivable","receive","paid","payment","diye","dena","hain","hai"]);party=text.trim().split(/\s+/).filter(w=>!stop.has(w.toLowerCase())&&!/\d/.test(w)).slice(0,3).join(" ");}
  return {type,accountHead:party,party,amount:Math.round(amount),description:text.trim(),date:emptyForm.date};
}

function App(){
 const [entries,setEntries]=useState(()=>{try{return JSON.parse(localStorage.getItem(KEY)||"[]")}catch{return[]}});
 const [form,setForm]=useState(emptyForm),[voice,setVoice]=useState(""),[listening,setListening]=useState(false);
 const [editing,setEditing]=useState(null),[filter,setFilter]=useState("All"),[search,setSearch]=useState(""),[selectedLedger,setSelectedLedger]=useState("");
 useEffect(()=>localStorage.setItem(KEY,JSON.stringify(entries)),[entries]);

 const totals=useMemo(()=>{const expense=entries.filter(e=>e.type==="Expense").reduce((a,e)=>a+Number(e.amount||0),0);const receipt=entries.filter(e=>e.type==="Receipt").reduce((a,e)=>a+Number(e.amount||0),0);const rec=entries.filter(e=>e.type==="Receivable").reduce((a,e)=>a+Number(e.amount||0),0);const pay=entries.filter(e=>e.type==="Payable").reduce((a,e)=>a+Number(e.amount||0),0);return {expense,receipt,rec,pay,difference:rec-pay}},[entries]);
 const accountHeads=useMemo(()=>[...new Set(entries.map(e=>(e.accountHead||e.party||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b)),[entries]);
 useEffect(()=>{if(!selectedLedger&&accountHeads.length)setSelectedLedger(accountHeads[0]);if(selectedLedger&&!accountHeads.includes(selectedLedger))setSelectedLedger(accountHeads[0]||"")},[accountHeads,selectedLedger]);

 const filtered=entries.filter(e=>(filter==="All"||e.type===filter)&&(`${e.accountHead||e.party||""} ${e.party||""} ${e.description||""}`).toLowerCase().includes(search.toLowerCase()));
 const ledgerEntries=useMemo(()=>selectedLedger?entries.filter(e=>(e.accountHead||e.party||"").trim()===selectedLedger).sort((a,b)=>String(a.date).localeCompare(String(b.date))):[],[entries,selectedLedger]);
 const ledgerRows=useMemo(()=>{let balance=0;return ledgerEntries.map(e=>{const debit=["Expense","Receivable"].includes(e.type)?Number(e.amount||0):0;const credit=["Receipt","Payable"].includes(e.type)?Number(e.amount||0):0;balance+=debit-credit;return {...e,debit,credit,balance}})},[ledgerEntries]);
 const ledgerTotals=useMemo(()=>({debit:ledgerRows.reduce((a,e)=>a+e.debit,0),credit:ledgerRows.reduce((a,e)=>a+e.credit,0),balance:ledgerRows.length?ledgerRows[ledgerRows.length-1].balance:0}),[ledgerRows]);

 function listen(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){alert("Speech recognition is not supported in this browser. Try Chrome on Android/desktop.");return}const r=new SR();r.lang="en-PK";r.interimResults=false;r.maxAlternatives=1;setListening(true);r.onresult=e=>{const text=e.results[0][0].transcript;setVoice(text);setForm(f=>({...f,...parseVoice(text)}));setListening(false)};r.onerror=()=>setListening(false);r.onend=()=>setListening(false);r.start()}
 function save(){const accountHead=(form.accountHead||"").trim();if(!accountHead||!Number(form.amount)){alert("Account Head aur amount enter karo.");return}const item={id:editing||crypto.randomUUID(),...form,accountHead,party:(form.party||"").trim(),amount:Number(form.amount)};setEntries(es=>editing?es.map(x=>x.id===editing?item:x):[item,...es]);setForm(emptyForm);setVoice("");setEditing(null)}
 function edit(e){setEditing(e.id);setForm({...emptyForm,...e,accountHead:e.accountHead||e.party||"",party:e.party||""});setVoice(e.description||"")}
 function del(id){if(confirm("Delete this entry?"))setEntries(es=>es.filter(e=>e.id!==id))}
 function exportCSV(){const head=["Date","Type","Account Head","Party","Amount","Description"];const rows=entries.map(e=>[e.date,e.type,e.accountHead||e.party||"",e.party||"",e.amount,e.description||""].map(v=>`"${String(v).replaceAll('"','""')}"`));const blob=new Blob([[head,...rows].map(r=>r.join(",")).join("\n")],{type:"text/csv"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="voice-accounts.csv";a.click()}
 async function shareLedger(){if(!selectedLedger||!ledgerRows.length){alert("Pehle koi account ledger select karo.");return}const lines=["VOICE ACCOUNTS",`Account: ${selectedLedger}`,"","Date | Particular | Debit | Credit | Balance",...ledgerRows.map(e=>`${e.date} | ${e.party||e.description||"-"} | ${e.debit?`Rs ${money(e.debit)}`:"-"} | ${e.credit?`Rs ${money(e.credit)}`:"-"} | Rs ${money(Math.abs(e.balance))} ${e.balance>=0?"Dr":"Cr"}`),"",`Total Debit: Rs ${money(ledgerTotals.debit)}`,`Total Credit: Rs ${money(ledgerTotals.credit)}`,`Closing Balance: Rs ${money(Math.abs(ledgerTotals.balance))} ${ledgerTotals.balance>=0?"Dr":"Cr"}`].join("\n");if(navigator.share){try{await navigator.share({title:`Ledger - ${selectedLedger}`,text:lines});return}catch(e){if(e?.name==="AbortError")return}}try{await navigator.clipboard.writeText(lines);alert("Ledger copy ho gaya. WhatsApp mein paste karke share kar sakte ho.")}catch{alert(lines)}}
 const money=n=>new Intl.NumberFormat("en-PK",{maximumFractionDigits:0}).format(n);

 return <div className="app">
  <header><div><h1>Voice Accounts</h1><p>Expenses • Receivable • Payable • Account Ledgers</p></div><button onClick={exportCSV}>Export CSV</button></header>
  <section className="cards"><Card title="Expenses" value={totals.expense}/><Card title="Receivable" value={totals.rec}/><Card title="Payable" value={totals.pay}/><div className="card difference"><span>Net Difference</span><strong>Rs {money(Math.abs(totals.difference))}</strong><small>{totals.difference>=0?"Receivable":"Payable"}</small></div></section>
  <main>
   <section className="panel entry"><h2>{editing?"Edit Entry":"New Entry"}</h2><div className="voicebox"><button className={"mic "+(listening?"on":"")} onClick={listen}>{listening?"Listening…":"🎙️ Speak Entry"}</button><div>{voice||"Example: “Ali ko 25000 advance diye”"}</div></div>
    <label>Type<select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>{["Expense","Receipt","Receivable","Payable"].map(x=><option key={x}>{x}</option>)}</select></label>
    <label>Account Head<input value={form.accountHead} onChange={e=>setForm({...form,accountHead:e.target.value})} placeholder="Cash / Bank / Salary / Ali / ABC Traders"/></label>
    <label>Party / Person<input value={form.party} onChange={e=>setForm({...form,party:e.target.value})} placeholder="Optional"/></label>
    <div className="grid2"><label>Amount<input type="number" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/></label><label>Date<input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label></div>
    <label>Description<input value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
    <div className="actions"><button className="primary" onClick={save}>{editing?"Update":"Confirm & Save"}</button>{editing&&<button onClick={()=>{setEditing(null);setForm(emptyForm);setVoice("")}}>Cancel</button>}</div>
   </section>
   <section className="panel"><div className="toolbar"><h2>Entries</h2><input placeholder="Search account..." value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="filters">{["All","Expense","Receipt","Receivable","Payable"].map(x=><button className={filter===x?"active":""} onClick={()=>setFilter(x)} key={x}>{x}</button>)}</div>
    <div className="tablewrap"><table><thead><tr><th>Date</th><th>Type</th><th>Account Head</th><th>Party</th><th>Amount</th><th></th></tr></thead><tbody>{filtered.map(e=><tr key={e.id}><td>{e.date}</td><td><span className={"tag "+e.type.toLowerCase()}>{e.type}</span></td><td><b>{e.accountHead||e.party}</b><small>{e.description}</small></td><td>{e.party||"—"}</td><td>Rs {money(e.amount)}</td><td><button onClick={()=>edit(e)}>Edit</button>{" "}<button onClick={()=>del(e.id)}>Delete</button></td></tr>)}</tbody></table>{!filtered.length&&<div className="empty">No entries yet.</div>}</div>
   </section>
  </main>
  <section className="panel ledger-panel"><div className="ledger-toolbar"><div><h2>Account Ledger</h2><p>Har Account Head ka separate running ledger.</p></div><div className="ledger-actions"><select value={selectedLedger} onChange={e=>setSelectedLedger(e.target.value)}>{!accountHeads.length&&<option value="">No account heads yet</option>}{accountHeads.map(a=><option key={a} value={a}>{a}</option>)}</select><button className="share-btn" onClick={shareLedger}>↗ Share Ledger</button></div></div>
   {selectedLedger&&<div className="ledger-stats"><div><span>Total Debit</span><strong>Rs {money(ledgerTotals.debit)}</strong></div><div><span>Total Credit</span><strong>Rs {money(ledgerTotals.credit)}</strong></div><div><span>Closing Balance</span><strong>Rs {money(Math.abs(ledgerTotals.balance))} {ledgerTotals.balance>=0?"Dr":"Cr"}</strong></div></div>}
   <div className="tablewrap">{selectedLedger?<table className="ledger-table"><thead><tr><th>Date</th><th>Particular</th><th>Type</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead><tbody>{ledgerRows.map(e=><tr key={e.id}><td>{e.date}</td><td><b>{e.party||e.description||"—"}</b><small>{e.description}</small></td><td><span className={"tag "+e.type.toLowerCase()}>{e.type}</span></td><td>{e.debit?`Rs ${money(e.debit)}`:"—"}</td><td>{e.credit?`Rs ${money(e.credit)}`:"—"}</td><td>Rs {money(Math.abs(e.balance))} {e.balance>=0?"Dr":"Cr"}</td></tr>)}</tbody></table>:<div className="empty ledger-empty">Entries add karo, phir account ledger yahan nazar aayega.</div>}{selectedLedger&&!ledgerRows.length&&<div className="empty">Is account ki koi entry nahi hai.</div>}</div>
  </section>
  <footer>Free MVP • Data is stored locally in this browser</footer>
 </div>
}
function Card({title,value}){return <div className="card"><span>{title}</span><strong>Rs {new Intl.NumberFormat("en-PK").format(value)}</strong></div>}
createRoot(document.getElementById("root")).render(<App/>);

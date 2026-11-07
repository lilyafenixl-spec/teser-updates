// TESER personal Work single-tab browser relay.
// No credentials, cap, run ID or task content are stored in storage, URL or logs.
(()=> {
  'use strict';
  const URL='https://vxswsuhyxcsklesruphy.supabase.co/functions/v1/teser-personal-work-bridge';
  const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const CHAT=/^https:\/\/chatgpt\.com\/c\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const CAP=/^[A-Za-z0-9_-]{43}$/;
  const reserve=document.getElementById('reserve-form');
  const finish=document.getElementById('finish-form');
  const reserveButton=document.getElementById('reserve-once');
  const finishButton=document.getElementById('finish-once');
  const status=document.getElementById('status');
  const taskSection=document.getElementById('task-section');
  const taskTitle=document.getElementById('task-title');
  const taskDescription=document.getElementById('task-description');
  const taskKind=document.getElementById('task-kind');
  let claim=null, claimAttempted=false, completionAttempted=false;
  const show=(message,failed=false)=>{
    status.textContent=message;
    status.setAttribute('role','status');
    status.dataset.state=failed?'stop':'info';
  };
  const post=async params=>{
    const response=await fetch(URL,{
      method:'POST',mode:'cors',credentials:'omit',redirect:'error',
      cache:'no-store',referrerPolicy:'no-referrer',
      signal:AbortSignal.timeout(20000),
      body:new URLSearchParams(params)
    });
    const type=(response.headers.get('content-type')||'').toLowerCase();
    if(!type.startsWith('text/html'))throw Error('invalid_response_type');
    const body=await response.text();
    if(body.length>16000)throw Error('response_too_large');
    return {response,body};
  };
  reserve.addEventListener('submit',async evt=>{
    evt.preventDefault();
    if(claimAttempted||claim)return;
    const event=document.getElementById('event-id').value.trim().toLowerCase();
    if(!UUID.test(event)){show('Некорректный UUID события. Резервирование не выполнялось.',true);return;}
    claimAttempted=true;
    reserveButton.disabled=true;
    show('Запрос однократного резервирования отправлен. Не повторяй его.');
    try {
      const {response,body}=await post({op:'claim',event});
      if(response.status!==200)throw Error('reservation_not_confirmed');
      const parsed=new DOMParser().parseFromString(body,'text/html');
      if(!parsed.body?.textContent?.includes('Резервирование подтверждено.'))
        throw Error('missing_server_claim_confirmation');
      const input=name=>parsed.querySelector('input[name="'+name+'"]')?.value||'';
      const run=input('run_id'),cap=input('finish_cap'),returned=input('event');
      const title=parsed.querySelector('h2')?.textContent?.trim()||'';
      const description=parsed.querySelector('pre')?.textContent?.trim()||'';
      if(!UUID.test(run)||!CAP.test(cap)||returned.toLowerCase()!==event||
         title.length<1||title.length>120||description.length<1||description.length>1800)
        throw Error('invalid_reserved_payload');
      // This closure is the ONLY store of the one-time secret.
      claim={event,run,cap};
      taskTitle.textContent=title;
      taskDescription.textContent=description;
      taskKind.textContent='Личное поручение TESER. Выполни задачу в одном новом независимом Work-чате.';
      taskSection.hidden=false;
      finish.hidden=false;
      show('Резервирование подтверждено. Создай новый Work-чат в другой вкладке. Сохрани эту вкладку открытой и не обновляй страницу.');
    } catch {
      show('Состояние резервирования неизвестно или сервер отказал. Не повторяй запрос, не выполняй поручение до сверки.',true);
    }
  });
  finish.addEventListener('submit',async evt=>{
    evt.preventDefault();
    if(!claim||completionAttempted)return;
    const chat=document.getElementById('chat-url').value.trim();
    const summary=document.getElementById('summary').value.trim();
    if(!CHAT.test(chat)||!summary||summary.length>600||
       new TextEncoder().encode(summary).byteLength>1200){
      show('Проверь настоящий URL нового Work-чата и краткий итог. Сохранение не выполнялось.',true);
      return;
    }
    completionAttempted=true;
    finishButton.disabled=true;
    show('Сохраняем результат один раз. Не повторяй операцию.');
    try{
      const {response,body}=await post({op:'complete',event:claim.event,
        run_id:claim.run,finish_cap:claim.cap,chat_url:chat,summary});
      if(response.status!==200||!body.includes('Результат сохранён'))
        throw Error('completion_not_verified');
      claim=null;
      show('Результат сохранён. TESER получил ссылку на новый Work-чат.');
    }catch{
      show('Исход сохранения неизвестен. Не повторяй запрос и не создавай новый чат.',true);
    }
  });
})();

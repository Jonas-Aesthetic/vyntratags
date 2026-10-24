const c=require('crypto');
const U={jberla:'e214de76a93c0de30efc36fb50d1f333$77c1ce3421c20ff2a3c5be943b6c819376fcdd0ae28a9f7e53cddd66d6af48c3',alvaroz:'6424f6320b1fea3554ec738229f289d8$31ceb5072ba12de3ad64e7f01ccf6e6d0e66732db336408feb68a65fa9dbcd4b'};
const SEC=process.env.SESSION_SECRET||'';
const RU=process.env.KV_REST_API_URL||process.env.UPSTASH_REDIS_REST_URL,RT=process.env.KV_REST_API_TOKEN||process.env.UPSTASH_REDIS_REST_TOKEN;
const R=async a=>{const x=await fetch(RU,{method:'POST',headers:{Authorization:'Bearer '+RT},body:JSON.stringify(a)});const j=await x.json();if(j.error)throw new Error(j.error);return j.result};
const sign=s=>c.createHmac('sha256',SEC).update(s).digest('base64url');
function who(req){const m=/(?:^|; )vs=([^;]+)/.exec(req.headers.cookie||'');if(!m||!SEC)return null;const[b,s]=m[1].split('.');if(!s)return null;const x=Buffer.from(sign(b)),y=Buffer.from(s);if(x.length!==y.length||!c.timingSafeEqual(x,y))return null;try{const t=JSON.parse(Buffer.from(b,'base64url'));return t.e>Date.now()?t.u:null}catch{return null}}
const t=(v,n)=>String(v??'').slice(0,n);
module.exports=async(req,res)=>{
  const a=req.query.a,u=who(req),body=req.body&&typeof req.body==='object'?req.body:{};
  const J=(o,s=200)=>{res.setHeader('Cache-Control','no-store');res.status(s).json(o)};
  const ck=v=>res.setHeader('Set-Cookie','vs='+v);
  try{
    if(a==='session')return J({user:u});
    if(a==='logout'){ck('; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict');return J({ok:1})}
    if(a==='login'&&req.method==='POST'){
      if(!SEC)return J({error:'SESSION_SECRET não configurado na Vercel'},500);
      const k=t(body.user,40).toLowerCase().trim(),[s,h]=(U[k]||'x$x').split('$');
      const d=c.scryptSync(t(body.pass,200),s,32),ok=!!U[k]&&c.timingSafeEqual(d,Buffer.from(h,'hex'));
      if(!ok){await new Promise(r=>setTimeout(r,900));return J({error:'Usuário ou senha inválidos'},401)}
      const b=Buffer.from(JSON.stringify({u:k,e:Date.now()+7*864e5})).toString('base64url');
      ck(b+'.'+sign(b)+'; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Strict');return J({user:k});
    }
    if(a==='products'){const v=await R(['GET','vyntra:data']);return J(v?JSON.parse(v):{items:null})}
    if(a==='save'&&req.method==='POST'){
      if(!u)return J({error:'Sessão expirada. Entre novamente.'},401);
      if(!Array.isArray(body.items)||body.items.length>100)return J({error:'Dados inválidos'},400);
      const items=[];
      for(const p of body.items){
        const imgs=[];
        for(const s of (Array.isArray(p.imgs)?p.imgs:[]).slice(0,12)){
          const m=/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(s));
          if(m){if(s.length>950000)continue;const k=c.createHash('sha256').update(s).digest('hex').slice(0,16);await R(['SET','vyntra:img:'+k,m[1]]);imgs.push('/api/app?a=img&k='+k)}
          else if(/^(\/api\/app\?a=img&k=[a-f0-9]{16}|[a-z0-9-]+\.jpg)$/.test(String(s)))imgs.push(s);
        }
        items.push({id:+p.id||Date.now(),title:t(p.title,120),tag:t(p.tag,200),cat:t(p.cat,40),story:t(p.story,4000),
          perks:(Array.isArray(p.perks)?p.perks:[]).slice(0,12).map(x=>t(x,200)),
          specs:(Array.isArray(p.specs)?p.specs:[]).slice(0,12).map(a=>[t(a&&a[0],60),t(a&&a[1],160)]),imgs});
      }
      const out={items,wa:t(body.wa,20).replace(/\D/g,'')};
      await R(['SET','vyntra:data',JSON.stringify(out)]);return J(out);
    }
    if(a==='img'){
      const k=t(req.query.k,20);if(!/^[a-f0-9]{16}$/.test(k))return J({error:'não encontrado'},404);
      const v=await R(['GET','vyntra:img:'+k]);if(!v)return J({error:'não encontrado'},404);
      res.setHeader('Content-Type','image/jpeg');res.setHeader('Cache-Control','public, max-age=31536000, immutable');return res.status(200).end(Buffer.from(v,'base64'));
    }
    return J({error:'não encontrado'},404);
  }catch(e){return J({error:'Erro no servidor'},500)}
};

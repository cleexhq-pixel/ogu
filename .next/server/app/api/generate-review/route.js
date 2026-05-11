"use strict";(()=>{var e={};e.id=969,e.ids=[969],e.modules={399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},2745:(e,o,a)=>{a.r(o),a.d(o,{originalPathname:()=>y,patchFetch:()=>f,requestAsyncStorage:()=>g,routeModule:()=>c,serverHooks:()=>_,staticGenerationAsyncStorage:()=>h});var n={};a.r(n),a.d(n,{POST:()=>p});var t=a(9303),r=a(8716),i=a(670),s=a(213),l=a(7070);let m=new s.ZP({apiKey:process.env.ANTHROPIC_API_KEY}),u={best_moment:{you_said_korean:"오빠를 정말 좋아해요",you_said_translation:"I really like you",you_said_romanization:"Oppareul jeongmal joahaeyo",idol_replied_korean:"고마워요~ 너무 행복해요",idol_replied_translation:"Thank you~ I'm so happy",idol_replied_romanization:"Gomawoyo~ neomu haengbokhaeyo",moment_type:"core_message"},missed_moment:{korean:"다음에 또 만나요",translation:"Let's meet again next time",romanization:"Daeume tto mannayo",tip:"Practice with confidence — your Korean is already understandable."},share_quote:"고마워요~ 너무 행복해요",share_quote_translation:"Thank you~ I'm so happy",share_quote_romanization:"Gomawoyo~ neomu haengbokhaeyo"},d={compliment:"expressing love and appreciation to their bias",birthday:"celebrating idol birthday",game:"playing a fun game with idol",request:"asking idol for a special action",ask:"asking a meaningful question",confession:"confessing love and gratitude"};async function p(e){try{let{scenario:o,voiceGender:a,positiveMoments:n,completedLines:t,totalLines:r,idolName:i}=await e.json()||{},s="string"==typeof i?i.trim():"",u=String(a||"").toLowerCase(),p=s.length>0?s:"male"===u||"m"===u?"JISUNG":"WONYOUNG",c=o&&d[o]?o:"compliment",g=d[c]||String(o||"practice session"),h=`You are an AI coach helping international K-pop fans practice for fansign video calls.

Scenario: ${g}
Idol: ${p}
User completed ${t??4}/${r??5} prepared lines.
Positive moments triggered: ${JSON.stringify(n??[])}

Generate a review JSON in this exact format:

{
  "best_moment": {
    "you_said_korean": "Korean line user delivered well",
    "you_said_translation": "English translation",
    "you_said_romanization": "Romanization of Korean (e.g. 'Annyeonghaseyo')",
    "idol_replied_korean": "Idol's natural Korean reaction",
    "idol_replied_translation": "English translation",
    "idol_replied_romanization": "Romanization of Korean reaction",
    "moment_type": "core_message" | "first_korean" | "name_remembered"
  },
  "missed_moment": {
    "korean": "Korean line that needed practice",
    "translation": "English translation",
    "romanization": "Romanization of Korean",
    "tip": "One short encouraging note about what to focus on for the real fansign moment (max 20 words, no mention of AI or technology)"
  },
  "share_quote": "The most shareable moment as a single Korean phrase under 15 chars",
  "share_quote_translation": "English translation of share quote",
  "share_quote_romanization": "Romanization of share quote"
}

Rules:
- Use realistic, casual Korean fan-idol speech (반말+존댓말 mix)
- Idol replies should be warm, short (under 10 syllables)
- Tip should be encouraging, not critical, and focused on the real fansign moment—do not mention AI, apps, or technology in the tip text
- If user did well (4+/5 lines), make best_moment about the core emotional message
- If user struggled, make best_moment about their first Korean attempt
- All Korean must be authentic, not literal translations
- Romanization should follow Revised Romanization (e.g. 안녕하세요 → Annyeonghaseyo)

Return ONLY the JSON, no other text.`,_=(await m.messages.create({model:"claude-sonnet-4-20250514",max_tokens:1e3,messages:[{role:"user",content:h}]})).content[0].text.trim().replace(/```json|```/g,"").trim(),y=JSON.parse(_);return l.NextResponse.json({success:!0,review:y})}catch(e){return console.error("Review generation error:",e),l.NextResponse.json({success:!1,error:e.message,review:u},{status:500})}}let c=new t.AppRouteRouteModule({definition:{kind:r.x.APP_ROUTE,page:"/api/generate-review/route",pathname:"/api/generate-review",filename:"route",bundlePath:"app/api/generate-review/route"},resolvedPagePath:"C:\\Users\\honge\\OneDrive\\바탕 화면\\LIFE_OS\\05. 일\\02. 기획 (이청)\\ogu\\app\\api\\generate-review\\route.js",nextConfigOutput:"",userland:n}),{requestAsyncStorage:g,staticGenerationAsyncStorage:h,serverHooks:_}=c,y="/api/generate-review/route";function f(){return(0,i.patchFetch)({serverHooks:_,staticGenerationAsyncStorage:h})}}};var o=require("../../../webpack-runtime.js");o.C(e);var a=e=>o(o.s=e),n=o.X(0,[948,972,292],()=>a(2745));module.exports=n})();
"use strict";(()=>{var e={};e.id=790,e.ids=[790],e.modules={399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},9620:(e,r,t)=>{t.r(r),t.d(r,{originalPathname:()=>N,patchFetch:()=>h,requestAsyncStorage:()=>m,routeModule:()=>d,serverHooks:()=>x,staticGenerationAsyncStorage:()=>g});var a={};t.r(a),t.d(a,{POST:()=>c});var n=t(9303),s=t(8716),o=t(670),i=t(213),p=t(7070);let u=new i.ZP({apiKey:process.env.ANTHROPIC_API_KEY}),l={compliment:"아이돌의 노래와 무대를 칭찬하고 싶은 팬",birthday:"아이돌 생일을 축하하고 싶은 팬",game:"아이돌과 가벼운 게임을 하고 싶은 팬",request:"아이돌에게 볼하트나 이름 불러주기를 요청하고 싶은 팬",ask:"아이돌에게 궁금한 것을 물어보고 싶은 팬",confession:"아이돌에 대한 마음을 전하고 싶은 팬"};async function c(e){try{let r;let t=(await e.json()).scenarioId;if(!t)return p.NextResponse.json({error:"scenarioId is required"},{status:400});let a=l[t]||"아이돌과 대화하고 싶은 팬",n=`당신은 K-pop 영통팬싸 90초 연습을 도와주는 코치입니다.
아래 상황에 맞는 한국어 대화 스크립트 4문장을 생성해주세요.

상황: ${a}

규칙:
- 모든 문장에 주어 포함
- 한 문장은 10음절 이내
- 지시대명사 사용 금지
- 실제 팬이 쓰는 구어체 사용
- 외모, 사생활, 연애 관련 질문 금지
- LINE 1: 인사 (안녕하세요로 시작)
- LINE 2: 핵심 메시지
- LINE 3: 대화 이어가기
- LINE 4: 마무리 (다음에 또 봐요로 끝)

JSON만 응답하세요:
{"lines":[{"label":"GREETING","korean":"","romanization":"","translation":""},{"label":"MAIN","korean":"","romanization":"","translation":""},{"label":"FOLLOW","korean":"","romanization":"","translation":""},{"label":"CLOSING","korean":"","romanization":"","translation":""}]}`,s=(await u.messages.create({model:"claude-sonnet-4-20250514",max_tokens:1e3,messages:[{role:"user",content:n}]})).content[0].text;try{let e=s.replace(/```json/g,"").replace(/```/g,"").trim();r=JSON.parse(e)}catch(e){return p.NextResponse.json({error:"Parse failed",raw:s},{status:500})}return p.NextResponse.json(r)}catch(e){return console.error("generate-script error:",e),p.NextResponse.json({error:e.message},{status:500})}}let d=new n.AppRouteRouteModule({definition:{kind:s.x.APP_ROUTE,page:"/api/generate-script/route",pathname:"/api/generate-script",filename:"route",bundlePath:"app/api/generate-script/route"},resolvedPagePath:"C:\\Users\\honge\\OneDrive\\바탕 화면\\LIFE_OS\\05. 일\\02. 기획 (이청)\\ogu\\app\\api\\generate-script\\route.js",nextConfigOutput:"",userland:a}),{requestAsyncStorage:m,staticGenerationAsyncStorage:g,serverHooks:x}=d,N="/api/generate-script/route";function h(){return(0,o.patchFetch)({serverHooks:x,staticGenerationAsyncStorage:g})}}};var r=require("../../../webpack-runtime.js");r.C(e);var t=e=>r(r.s=e),a=r.X(0,[948,972,292],()=>t(9620));module.exports=a})();
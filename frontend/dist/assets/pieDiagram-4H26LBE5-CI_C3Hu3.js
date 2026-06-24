import{i as e,r as t}from"./src-BT_lIm38.js";import{n}from"./path-DdI2OVsN.js";import{m as r}from"./dist-CTmDzRE8.js";import{t as i}from"./arc-CF12K8yk.js";import{t as a}from"./array-BifhSqXX.js";import{i as o,p as s}from"./chunk-5ZQYHXKU-DnJSUYi1.js";import{H as c,K as l,U as u,a as d,c as f,f as p,v as m,w as h,x as g,y as _}from"./chunk-CSCIHK7Q-DiJcceGg.js";import{k as v,u as y}from"./index-CPcl-1s1.js";import{t as b}from"./mermaid-parser.core-BqYR0_hz.js";import{t as x}from"./chunk-4BX2VUAB-YC93WdYo.js";function S(e,t){return t<e?-1:t>e?1:t>=e?0:NaN}function C(e){return e}function w(){var e=C,t=S,i=null,o=n(0),s=n(r),c=n(0);function l(n){var l,u=(n=a(n)).length,d,f,p=0,m=Array(u),h=Array(u),g=+o.apply(this,arguments),_=Math.min(r,Math.max(-r,s.apply(this,arguments)-g)),v,y=Math.min(Math.abs(_)/u,c.apply(this,arguments)),b=y*(_<0?-1:1),x;for(l=0;l<u;++l)(x=h[m[l]=l]=+e(n[l],l,n))>0&&(p+=x);for(t==null?i!=null&&m.sort(function(e,t){return i(n[e],n[t])}):m.sort(function(e,n){return t(h[e],h[n])}),l=0,f=p?(_-u*b)/p:0;l<u;++l,g=v)d=m[l],x=h[d],v=g+(x>0?x*f:0)+b,h[d]={data:n[d],index:l,value:x,startAngle:g,endAngle:v,padAngle:y};return h}return l.value=function(t){return arguments.length?(e=typeof t==`function`?t:n(+t),l):e},l.sortValues=function(e){return arguments.length?(t=e,i=null,l):t},l.sort=function(e){return arguments.length?(i=e,t=null,l):i},l.startAngle=function(e){return arguments.length?(o=typeof e==`function`?e:n(+e),l):o},l.endAngle=function(e){return arguments.length?(s=typeof e==`function`?e:n(+e),l):s},l.padAngle=function(e){return arguments.length?(c=typeof e==`function`?e:n(+e),l):c},l}var T=p.pie,E={sections:new Map,showData:!1,config:T},D=E.sections,O=E.showData,k=structuredClone(T),A={getConfig:t(()=>structuredClone(k),`getConfig`),clear:t(()=>{D=new Map,O=E.showData,d()},`clear`),setDiagramTitle:l,getDiagramTitle:h,setAccTitle:u,getAccTitle:_,setAccDescription:c,getAccDescription:m,addSection:t(({label:t,value:n})=>{if(n<0)throw Error(`"${t}" has invalid value: ${n}. Negative values are not allowed in pie charts. All slice values must be >= 0.`);D.has(t)||(D.set(t,n),e.debug(`added new section: ${t}, with value: ${n}`))},`addSection`),getSections:t(()=>D,`getSections`),setShowData:t(e=>{O=e},`setShowData`),getShowData:t(()=>O,`getShowData`)},j=t((e,t)=>{x(e,t),t.setShowData(e.showData),e.sections.map(t.addSection)},`populateDb`),M={parse:t(async t=>{let n=await b(`pie`,t);e.debug(n),j(n,A)},`parse`)},N=t(e=>`
  .pieCircle{
    stroke: ${e.pieStrokeColor};
    stroke-width : ${e.pieStrokeWidth};
    opacity : ${e.pieOpacity};
  }
  .pieOuterCircle{
    stroke: ${e.pieOuterStrokeColor};
    stroke-width: ${e.pieOuterStrokeWidth};
    fill: none;
  }
  .pieTitleText {
    text-anchor: middle;
    font-size: ${e.pieTitleTextSize};
    fill: ${e.pieTitleTextColor};
    font-family: ${e.fontFamily};
  }
  .slice {
    font-family: ${e.fontFamily};
    fill: ${e.pieSectionTextColor};
    font-size:${e.pieSectionTextSize};
    // fill: white;
  }
  .legend text {
    fill: ${e.pieLegendTextColor};
    font-family: ${e.fontFamily};
    font-size: ${e.pieLegendTextSize};
  }
`,`getStyles`),P=t(e=>{let t=[...e.values()].reduce((e,t)=>e+t,0),n=[...e.entries()].map(([e,t])=>({label:e,value:t})).filter(e=>e.value/t*100>=1);return w().value(e=>e.value).sort(null)(n)},`createPieArcs`),F={parser:M,db:A,renderer:{draw:t((t,n,r,a)=>{e.debug(`rendering pie chart
`+t);let c=a.db,l=g(),u=o(c.getConfig(),l.pie),d=y(n),p=d.append(`g`);p.attr(`transform`,`translate(225,225)`);let{themeVariables:m}=l,[h]=s(m.pieOuterStrokeWidth);h??=2;let _=u.textPosition,b=i().innerRadius(0).outerRadius(185),x=i().innerRadius(185*_).outerRadius(185*_);p.append(`circle`).attr(`cx`,0).attr(`cy`,0).attr(`r`,185+h/2).attr(`class`,`pieOuterCircle`);let S=c.getSections(),C=P(S),w=[m.pie1,m.pie2,m.pie3,m.pie4,m.pie5,m.pie6,m.pie7,m.pie8,m.pie9,m.pie10,m.pie11,m.pie12],T=0;S.forEach(e=>{T+=e});let E=C.filter(e=>(e.data.value/T*100).toFixed(0)!==`0`),D=v(w).domain([...S.keys()]);p.selectAll(`mySlices`).data(E).enter().append(`path`).attr(`d`,b).attr(`fill`,e=>D(e.data.label)).attr(`class`,`pieCircle`),p.selectAll(`mySlices`).data(E).enter().append(`text`).text(e=>(e.data.value/T*100).toFixed(0)+`%`).attr(`transform`,e=>`translate(`+x.centroid(e)+`)`).style(`text-anchor`,`middle`).attr(`class`,`slice`);let O=p.append(`text`).text(c.getDiagramTitle()).attr(`x`,0).attr(`y`,-400/2).attr(`class`,`pieTitleText`),k=[...S.entries()].map(([e,t])=>({label:e,value:t})),A=p.selectAll(`.legend`).data(k).enter().append(`g`).attr(`class`,`legend`).attr(`transform`,(e,t)=>{let n=22*k.length/2;return`translate(216,`+(t*22-n)+`)`});A.append(`rect`).attr(`width`,18).attr(`height`,18).style(`fill`,e=>D(e.label)).style(`stroke`,e=>D(e.label)),A.append(`text`).attr(`x`,22).attr(`y`,14).text(e=>c.getShowData()?`${e.label} [${e.value}]`:e.label);let j=512+Math.max(...A.selectAll(`text`).nodes().map(e=>e?.getBoundingClientRect().width??0)),M=O.node()?.getBoundingClientRect().width??0,N=450/2-M/2,F=450/2+M/2,I=Math.min(0,N),L=Math.max(j,F)-I;d.attr(`viewBox`,`${I} 0 ${L} 450`),f(d,450,L,u.useMaxWidth)},`draw`)},styles:N};export{F as diagram};
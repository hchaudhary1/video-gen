// Deterministic vector objects for the finance story. No presentation chrome.
export const C={bg:'#080e1b',white:'#f5f3e9',muted:'#9caec6',cyan:'#39d8e6',blue:'#5d8fff',gold:'#ffc65c',red:'#f27776',dark:'#142238',paper:'#eee9de',ink:'#13243c'};
export const clamp=v=>Math.max(0,Math.min(1,v));
export const lerp=(a,b,p)=>a+(b-a)*p;
export const ease=p=>1-Math.pow(1-clamp(p),3);
export const prog=(s,at,dur=1)=>ease((s.t-s.time(at))/dur);
export function txt(s,str,x,y,size=48,at=0,out=undefined,o={}){
 if(o.color===C.ink || o.color==='#53657a')o={bg:C.paper,padding:0,radius:0,...o};
 return s.text(str,{x,y,size,font:'display',weight:900,color:C.white,at,out,enter:'fade',dur:.35,outDur:.25,maxWidth:1640,...o});
}
export function canvas(s,fn,at=0,out=undefined){s.draw({at,out,enter:'none'},ctx=>fn(ctx));}
export function base(s,light=false){s.theme.shadow=null;s.bg(light?C.paper:C.bg);}
export function rr(ctx,x,y,w,h,fill,stroke=null,r=16){ctx.beginPath();ctx.roundRect(x-w/2,y-h/2,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=3;ctx.stroke()}}
export function line(ctx,pts,color=C.cyan,width=4,p=1,dashed=false){
 ctx.save();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';if(dashed)ctx.setLineDash([12,13]);
 const lengths=pts.slice(1).map((v,i)=>Math.hypot(v[0]-pts[i][0],v[1]-pts[i][1]));let remaining=lengths.reduce((a,b)=>a+b,0)*clamp(p);
 ctx.beginPath();ctx.moveTo(...pts[0]);for(let i=0;i<lengths.length;i++){const part=Math.min(1,remaining/lengths[i]);ctx.lineTo(lerp(pts[i][0],pts[i+1][0],part),lerp(pts[i][1],pts[i+1][1],part));remaining-=lengths[i];if(remaining<=0)break}ctx.stroke();ctx.restore();
}
export function disc(ctx,x,y,r,color,stroke=null){ctx.beginPath();ctx.arc(x,y,Math.max(.1,r),0,Math.PI*2);if(color){ctx.fillStyle=color;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=3;ctx.stroke()}}
export function coin(ctx,x,y,r=19,color=C.gold){disc(ctx,x,y,r,color);disc(ctx,x,y,r*.75,null,'#805a28');line(ctx,[[x,y-r*.45],[x,y+r*.45]],'#805a28',3)}
export function stack(ctx,x,y,n=5,color=C.gold,scale=1){for(let i=0;i<n;i++)coin(ctx,x,y-i*11*scale,28*scale,color)}
export function packet(ctx,x,y,color=C.cyan){rr(ctx,x,y,27,19,color,null,5)}
export function flow(ctx,pts,t,start=0,color=C.gold,count=5){
 const p=ease((t-start)/1.2);line(ctx,pts,'#34455e',4,p);if(t<start)return;
 const ls=pts.slice(1).map((a,i)=>Math.hypot(a[0]-pts[i][0],a[1]-pts[i][1])),total=ls.reduce((a,b)=>a+b,0);
 for(let i=0;i<count;i++){let d=((Math.max(0,t-start)*.10+i/count)%1)*total;if(d>p*total)continue;
 for(let k=0;k<ls.length;k++){if(d<=ls[k]){coin(ctx,lerp(pts[k][0],pts[k+1][0],d/ls[k]),lerp(pts[k][1],pts[k+1][1],d/ls[k]),12,color);break}d-=ls[k]}}
}
export function rack(ctx,x,y,w=220,h=370,t=0,p=1){
 ctx.save();ctx.globalAlpha*=clamp(p);ctx.fillStyle='#101d31';ctx.beginPath();ctx.moveTo(x-w/2,y-h/2);ctx.lineTo(x-w/2+36,y-h/2-30);ctx.lineTo(x+w/2+36,y-h/2-30);ctx.lineTo(x+w/2,y-h/2);ctx.closePath();ctx.fill();
 ctx.fillStyle='#1d334b';ctx.beginPath();ctx.moveTo(x+w/2,y-h/2);ctx.lineTo(x+w/2+36,y-h/2-30);ctx.lineTo(x+w/2+36,y+h/2-30);ctx.lineTo(x+w/2,y+h/2);ctx.closePath();ctx.fill();
 rr(ctx,x,y,w,h,'#11243b',C.cyan,10);
 for(let i=0;i<5;i++){let yy=y-h*.35+i*h*.175;rr(ctx,x,yy,w*.8,h*.12,'#203a54',null,5);disc(ctx,x-w*.28,yy,4,C.cyan);for(let j=0;j<5;j++)rr(ctx,x-w*.09+j*w*.065,yy,5,h*.045,(Math.sin(t*2+i+j)>0)?C.cyan:'#3d5872',null,1)}
 ctx.restore();
}
export function person(ctx,x,y,scale=1,color=C.white){disc(ctx,x,y-55*scale,23*scale,color);ctx.beginPath();ctx.roundRect(x-36*scale,y-20*scale,72*scale,90*scale,[28*scale,28*scale,12*scale,12*scale]);ctx.fillStyle=color;ctx.fill()}
export function people(ctx,x,y,n=3,scale=.7,color=C.white){for(let i=0;i<n;i++)person(ctx,x+(i-(n-1)/2)*105*scale,y,scale,color)}
export function paper(ctx,x,y,w=350,h=430,color=C.paper){
 ctx.save();ctx.shadowBlur=35;ctx.shadowColor='#00000055';ctx.shadowOffsetY=12;rr(ctx,x,y,w,h,color,null,6);ctx.restore();
 ctx.fillStyle='#cbd0cf';ctx.beginPath();ctx.moveTo(x+w/2-50,y-h/2);ctx.lineTo(x+w/2,y-h/2+50);ctx.lineTo(x+w/2-50,y-h/2+50);ctx.closePath();ctx.fill();
}
export function rows(ctx,x,y,w=220,n=5,color='#8293a8'){for(let i=0;i<n;i++)line(ctx,[[x-w/2,y+i*28],[x+w/2*(i%2?.65:1),y+i*28]],color,6)}
export function clock(ctx,x,y,r=80,p=0,color=C.gold){disc(ctx,x,y,r,color===C.ink?C.paper:C.bg,color);for(let i=0;i<12;i++){let a=i*Math.PI/6;line(ctx,[[x+Math.cos(a)*(r-14),y+Math.sin(a)*(r-14)],[x+Math.cos(a)*(r-5),y+Math.sin(a)*(r-5)]],color,3)}let a=-Math.PI/2+p*2*Math.PI;line(ctx,[[x,y],[x+Math.cos(a)*r*.66,y+Math.sin(a)*r*.66]],color,5);line(ctx,[[x,y],[x-r*.3,y-r*.15]],color,5)}
export function gate(ctx,x,y,open=0){line(ctx,[[x-65,y+110],[x-65,y-110],[x+65,y-110],[x+65,y+110]],C.blue,12);ctx.save();ctx.translate(x-65,y-100);ctx.rotate(-open*Math.PI/2);line(ctx,[[0,0],[125,190]],C.gold,9);ctx.restore()}
export function ring(ctx,x,y,r,p,color=C.cyan,width=18,start=-Math.PI/2){ctx.save();ctx.strokeStyle='#203147';ctx.lineWidth=width;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();ctx.strokeStyle=color;ctx.beginPath();ctx.arc(x,y,r,start,start+Math.PI*2*Math.max(.001,clamp(p)));ctx.stroke();ctx.restore()}
export function magnifier(ctx,x,y,r=72,color=C.gold){disc(ctx,x,y,r,'#102036aa',color);line(ctx,[[x+r*.7,y+r*.7],[x+r*1.3,y+r*1.3]],color,14)}
export function spark(ctx,x,y,w=460,h=180,p=1,color=C.cyan){const v=[.70,.48,.57,.25,.40,.16,.38,.32,.60,.43,.66];line(ctx,v.map((q,i)=>[x-w/2+i*w/(v.length-1),y-h/2+q*h]),color,6,p)}
export function footage(s,src,at=0,out=undefined,opacity=.55){s.clip(src,{x:s.cx,y:s.cy,w:s.W,h:s.H,at,out,enter:'fade',exit:'fade',dur:.6,outDur:.6,volume:0,opacity,radius:0});}
export function source(s,label,at=0,out=undefined,light=false){txt(s,label,160,1020,25,at,out,{align:'left',color:light?'#53657a':C.muted});}

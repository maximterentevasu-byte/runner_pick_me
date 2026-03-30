const c=document.getElementById('game');const ctx=c.getContext('2d');
const bg=new Image();bg.src='./assets/bg.jpg';
const runs=[];for(let i=1;i<=8;i++){let im=new Image();im.src='./assets/run-'+i+'.png';runs.push(im);}
const jump=new Image();jump.src='./assets/jump.png';
const box=new Image();box.src='./assets/obstacle-box.png';
let t=0,frame=0,x=0,obs=[{x:400,y:500}];

function draw(){
ctx.clearRect(0,0,420,640);
if(bg.complete){
let p=ctx.createPattern(bg,'repeat');
ctx.fillStyle=p;ctx.fillRect(0,0,420,640);
}
// horizon
ctx.strokeStyle='rgba(255,255,255,0.6)';ctx.lineWidth=2;
ctx.beginPath();ctx.moveTo(0,520);ctx.lineTo(420,520);ctx.stroke();

frame=(frame+0.2)%8;
let img=runs[Math.floor(frame)];
if(img.complete)ctx.drawImage(img,50,420,120,120);

for(let o of obs){
o.x-=3;
ctx.drawImage(box,o.x,o.y,80,80);
}
requestAnimationFrame(draw);
}
draw();
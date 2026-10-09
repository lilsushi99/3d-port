// Seeds the sample content from the original prototype. Safe to re-run: only fills EMPTY tables / missing settings.
const db = require('./db');
const S = {
 'site.name':'Dominion','site.owner':'Dominion Abiodun','site.copyright':'Copyright 2026.','site.contact_email':'hello@example.com','site.default_theme':'system',
 'hero.bio_html':"<p>hey, i'm dominion. i build <b>business intelligence</b> tools on top of <b>ERP</b>, <b>POS</b> and <b>CRM</b> systems, turning business data into charts, stats and insights. i also work across <b>product design</b>, <b>software development</b> and <b>data analysis</b>.</p>",
 'hero.reach_text':'You can reach me on the following channels.','hero.cta_label':'See my work','hero.cta_target':'#work','hero.mouse_target':'#/playground','hero.screen_video_media_id':'',
 'work.title':'Selected Work','work.all_label':'All',
 'about.name':'Dominion Abiodun','about.role':'Product designer · Developer · Data analyst','about.image_media_id':'',
 'about.html':'<p>hey, i\'m dominion. i design and build <b>business intelligence</b> tools, the kind that sit on top of <b>ERP</b>, <b>POS</b> and <b>CRM</b> platforms. at this stage of my career, my focus is building intelligent software that helps businesses understand their own numbers.</p><p>every business piles up transactions, records and statistics. i turn that into charts, highs and lows, and insights people can act on. alongside this i do <b>product design</b> and <b>full-stack development</b>, and i teach <b>data analysis</b>. before that i was a lead customer support specialist at boardgame art, and a financial analyst at <a href="https://manstarlimited.com">manstar</a>, a uk e-commerce brand.</p><p>love,<br>dominion</p>',
 'footprint.title':'Our Global Footprint','footprint.text':'Clients and companies I have worked with around the world.','footprint.contact_label':'Contact','footprint.show_count':'0'
};
const buttons=[['about','About','Read About Me','#/about','cyan'],['work','Work','Selected Work','#work','mustard'],['clients','Clients',"Where I've Worked",'#globe','red']];
const socials=[['LinkedIn','linkedin','https://linkedin.com'],['X','x','https://x.com'],['WhatsApp','whatsapp','https://wa.me/2340000000'],['Email','email','mailto:hello@example.com'],['Facebook','facebook','https://facebook.com']];
const cats=['Mobile App','Website','Web App','Data','Articles','Photography','Product Design'];
const projects=[
['Karwa','Mobile App','Karwa Mobility','2026','Product design, mobile','Ride-hailing app for city commuters.','A ride-hailing app built for crowded, unpredictable commutes: live routes, honest ETAs and a booking flow that works on a weak connection.','#1fb58f','#0b6e57',[['12k','active riders'],['4.8','app rating'],['−30%','booking time']]],
['Mimikry','Website','Mimikry Labs','2026','Design, development','Marketing site with a living brand mark.','A brand site where the logo is a living object. Motion, type and a small content system let the team publish without touching code.','#6c5ce7','#2d1b69',[]],
['Secondz','Web App','Secondz','2025','Product design, front-end','Discovery product for restaurants.','A discovery product that helps people find their next favourite table, with fast filters, honest reviews and a map that stays out of the way.','#f2b632','#b8581a',[]],
['Anima','Website','Anima Studio','2025','Design, motion','Campaign storytelling site.','A long-scroll campaign site for a film studio. Every section is paced like a cut, with type and footage carrying the story.','#2d3436','#101214',[]],
['Ledgerly','Data','Ledgerly','2025','Data analysis, dashboard','Spending dashboard and analysis.','Spending analysis for small teams: a data model, a dashboard and a weekly brief that turns raw transactions into decisions.','#19b5c6','#0a4f63',[['3x','faster reports'],['40+','dashboards'],['98%','data accuracy']]],
['Field Notes','Articles','Self','2024','Writing, design','Essay on designing for slow networks.','A long-form essay series on designing for slow networks, with annotated screenshots and measurements from real devices.','#e5483b','#7a1c14',[]],
['Harmattan','Photography','Self','2024','Photography','Lagos street light series.','Street photography from Lagos in harmattan season, when dust turns the afternoon light amber and the city goes soft.','#d9a56a','#4b3322',[]],
['Showtime POS','Product Design','Showtime Cinemas','2024','Product design','Seat-booking point of sale.','A point of sale for cinema box offices: a seat map that reads at a glance and a checkout that takes seconds.','#8e9aaf','#2b2d42',[]]];
const countries=[['566','Nigeria','Abuja',9.08,7.40],['840','United States','Washington, D.C.',38.91,-77.04],['826','United Kingdom','London',51.51,-0.13],['124','Canada','Ottawa',45.42,-75.70],['288','Ghana','Accra',5.60,-0.19]];
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
(async()=>{
 for(const [k,v] of Object.entries(S)) await db.query('INSERT IGNORE INTO settings (`key`,`value`) VALUES (?,?)',[k,v]);
 const empty=async t=>(await db.query(`SELECT COUNT(*) n FROM ${t}`))[0][0].n===0;
 if(await empty('laptop_buttons')) for(const [i,b] of buttons.entries()) await db.query('INSERT INTO laptop_buttons (slug,label,hover_text,target,color,sort_order) VALUES (?,?,?,?,?,?)',[...b.slice(0,5),i]);
 if(await empty('social_channels')) for(const [i,s] of socials.entries()) await db.query('INSERT INTO social_channels (name,icon_key,url,sort_order) VALUES (?,?,?,?)',[...s,i]);
 if(await empty('categories')) for(const [i,c] of cats.entries()) await db.query('INSERT INTO categories (name,slug,sort_order) VALUES (?,?,?)',[c,slug(c),i]);
 if(await empty('projects')) for(const [i,p] of projects.entries()){
  const [[c]]=await db.query('SELECT id FROM categories WHERE name=?',[p[1]]);
  const [r]=await db.query('INSERT INTO projects (title,slug,category_id,client,year,role,summary,overview,accent_a,accent_b,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?)',[p[0],slug(p[0]),c&&c.id,p[2],p[3],p[4],p[5],p[6],p[7],p[8],i]);
  for(const [j,m] of p[9].entries()) await db.query('INSERT INTO project_metrics (project_id,value,label,sort_order) VALUES (?,?,?,?)',[r.insertId,m[0],m[1],j]);}
 if(await empty('countries')) for(const [i,c] of countries.entries()) await db.query('INSERT INTO countries (iso_numeric,name,capital,marker_lat,marker_lng,sort_order) VALUES (?,?,?,?,?,?)',[...c,i]);
 console.log('seed complete'); process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});

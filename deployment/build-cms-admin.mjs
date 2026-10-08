import {readFile,mkdir,writeFile} from "node:fs/promises";
import {build} from "esbuild";
export async function buildCmsAdmin(){
 const target="dist-staging/admin";await mkdir(target+"/_astro",{recursive:true});
 const source=await readFile("src/pages/admin/index.astro","utf8");
 let html=source.replace(/^---[\s\S]*?---\s*/,"");
 const styles=[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(match=>match[1]).join("\n");
 html=html.replace(/<style[^>]*>[\s\S]*?<\/style>/g,"").replace(/<script[^>]*>[\s\S]*?<\/script>/g,"").replaceAll("{pageTitle}","Website administration \u2014 Saving Grace Bible Church");
 if(/\{(?:pageTitle|Astro\.)/.test(html))throw Error("cms_admin_template_unresolved");
 html=html.replace("</head>",'<link rel="stylesheet" href="/_astro/cms-admin.css"></head>').replace("</body>",'<script type="module" src="/_astro/cms-admin.js"></script></body>');
 await writeFile(target+"/index.html",html);
 const baseCss=(await readFile("src/admin/workbench.css","utf8"))+"\n"+styles;
 const result=await build({entryPoints:["src/admin/dashboard.ts"],outfile:target+"/_astro/cms-admin.js",bundle:true,preserveSymlinks:true,platform:"browser",target:"es2022",format:"esm",metafile:true,minify:true,sourcemap:false,legalComments:"none",logLevel:"silent"});
 await writeFile(target+"/_astro/cms-admin.css",baseCss+"\n"+await readFile(target+"/_astro/cms-admin.css","utf8").catch(()=>""));
 const inputs=Object.keys(result.metafile.inputs).sort();if(inputs.some(path=>/(?:local-test-identity|googleapis|transformers)/i.test(path)||(!path.includes("/node_modules/")&&/(?:private\/|development-data\/)/i.test(path))))throw Error("prohibited_cms_admin_input");
 await writeFile("dist-staging/cms-admin.inputs.json",JSON.stringify([...inputs,"src/pages/admin/index.astro","src/admin/workbench.css"].sort()));
}
if(process.argv[1]?.replaceAll("\\","/").endsWith("/build-cms-admin.mjs"))await buildCmsAdmin();

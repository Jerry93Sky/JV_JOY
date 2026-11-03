import type { TraceStep, ValueStatus } from './types.ts'
import { traceStep } from './trace.ts'
import { EngineError } from './errors.ts'
export interface RuleContext { readonly inputs:Readonly<Record<string,unknown>>; readonly results:Readonly<Record<string,unknown>> }
export interface CalculationRule { readonly id:string; readonly version:string; readonly dependsOn:readonly string[]; readonly source?:TraceStep['source']; readonly execute:(context:RuleContext)=>unknown }
export interface GraphResult { readonly status:ValueStatus; readonly values:Readonly<Record<string,unknown>>; readonly trace:readonly TraceStep[] }
export function executeGraph(inputs:Readonly<Record<string,unknown>>,rules:readonly CalculationRule[]):GraphResult{
 const byId=new Map<string,CalculationRule>();for(const r of rules){if(byId.has(r.id))throw new EngineError('INVALID_CONFIGURATION',`Duplicate rule: ${r.id}`);byId.set(r.id,r)}
 for(const r of rules)for(const dep of r.dependsOn)if(!(dep in inputs)&&!byId.has(dep))throw new EngineError('DEPENDENCY_UNKNOWN',`Rule ${r.id} depends on unknown input/rule ${dep}`,{ruleId:r.id,dependency:dep})
 const state=new Map<string,0|1|2>();const order:string[]=[];const visit=(id:string,stack:string[])=>{const s=state.get(id)??0;if(s===2)return;if(s===1)throw new EngineError('DEPENDENCY_CYCLE',`Dependency cycle: ${[...stack,id].join(' -> ')}`,{cycle:[...stack,id]});state.set(id,1);for(const d of byId.get(id)!.dependsOn)if(byId.has(d))visit(d,[...stack,id]);state.set(id,2);order.push(id)}
 for(const id of byId.keys())visit(id,[])
 const values:Record<string,unknown>={};const trace:TraceStep[]=[]
 for(const id of order){const rule=byId.get(id)!;let result:unknown;try{result=rule.execute(Object.freeze({inputs,results:Object.freeze({...values})}))}catch(e){if(e instanceof EngineError)throw e;throw new EngineError('RULE_FAILED',`Rule ${id} failed: ${e instanceof Error?e.message:String(e)}`,{ruleId:id,version:rule.version})}values[id]=result;trace.push(traceStep({id,kind:'validation',label:id,inputRefs:rule.dependsOn,ruleId:rule.id,source:rule.source,catalogRefs:[{id:rule.id,version:rule.version}],input:Object.fromEntries(rule.dependsOn.map(k=>[k,k in inputs?inputs[k]:values[k]])),result,status:'ok',errorIds:[],warningIds:[]}))}
 return Object.freeze({status:'ok',values:Object.freeze(values),trace:Object.freeze(trace)})
}

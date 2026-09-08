import { Annotation, StateGraph } from '@langchain/langgraph'
import { STEPS } from './domain.js'

// MongoDB checkpoints live in the runner; the graph controls step dependencies.
const state = Annotation.Root({ execute: Annotation() })
const workflow = new StateGraph(state)
for (const step of STEPS) workflow.addNode(step, async value => { await value.execute(step); return {} })
workflow.addEdge('__start__', STEPS[0])
STEPS.forEach((step, index) => workflow.addEdge(step, STEPS[index + 1] || '__end__'))
const graph = workflow.compile()
export const runGraph = execute => graph.invoke({ execute })

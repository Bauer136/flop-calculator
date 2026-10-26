import * as Comlink from 'comlink'
import {
  assignGroups,
  computeEquity,
  hotness,
  nextCardStats,
  preflopStats,
  runStreets,
} from '../engine/index.ts'
import type { EngineApi } from './api.ts'

const api: EngineApi = {
  analyze(req) {
    return req.players.map((player, p) => {
      const equity = req.equity?.[p] ?? undefined
      const result = runStreets(player.range, req.board, req.dead, player.filters, {
        customStats: req.customStats,
      })
      return {
        preflop: result.preflop,
        streets: result.streets.map((s) => {
          const ctx = {
            customStats: req.customStats,
            equity: equity && req.equityStreet === s.street ? equity : undefined,
          }
          return {
            ...s,
            groups: assignGroups(s.stats.weights, s.stats.classes, req.groups, ctx),
          }
        }),
      }
    })
  },

  nextCard(req) {
    return nextCardStats(req.weights, req.board, req.dead, { customStats: req.customStats })
  },

  equity(req, onProgress) {
    return computeEquity(req, onProgress ? { onProgress } : {})
  },

  hotness(req, onProgress) {
    return hotness(req.hero, req.villain, req.board, req.dead, {
      onProgress: onProgress ? (p) => onProgress(p.fraction) : undefined,
    })
  },

  preflopStats(req, onProgress) {
    return preflopStats(req.range, req.dead, { onProgress })
  },
}

Comlink.expose(api)

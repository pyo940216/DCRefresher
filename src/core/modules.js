const log = require('../utils/logger')
const store = require('../utils/store')

;(() => {
  let module_store = {}

  const modules = {
    lists: module_store,
    register: (mod, ...plugins) => {
      if (typeof module_store[mod.name] !== 'undefined') {
        throw new Error(`${mod.name} is already registered.`)
      }

      if (store.get(`${mod.name}.status`) === null) {
        store.set(`${mod.name}.status`, JSON.stringify(mod.status))
      }

      if (store.get(`${mod.name}.enable`) === null) {
        store.set(`${mod.name}.enable`, mod.default_enable)
      }

      mod.status = JSON.parse(store.get(`${mod.name}.status`))
      module_store[mod.name] = mod

      if (mod.url && !mod.url.test(location.href)) {
        log(`📁 ignoring ${mod.name}. current URL is not matching with the module\'s URL value.`)
        return
      }

      mod.func(...plugins)

      log(`📁 ${mod.name} module loaded.`)
    }
  }

  module.exports = modules
})()
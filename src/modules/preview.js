;(() => {
  let MODULE = {
    name: '미리보기',
    description: '글을 오른쪽 클릭 했을때 미리보기 창을 만들어줍니다.',
    author: 'Sochiru',
    status: false,
    memory: {},
    enable: true,
    default_enable: true,
    require: ['filter'],
    func (filter) {
      console.log('')
    }
  }

  module.exports = MODULE
})()

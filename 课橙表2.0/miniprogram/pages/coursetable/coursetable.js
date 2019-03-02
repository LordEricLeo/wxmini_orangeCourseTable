// pages/coursetable/coursetable.js
const app = getApp()
const db = app.globalData.db
let memoI
let memoJ
let colorlist = ['#0074D9', '#7FDBFF', '#3D9970', '#39CCCC', '#FFDC00', '#FF4136', '#B10DC9']
Page({

  /**
   * 页面的初始数据
   */
  data: {
    screenWidth: app.globalData.screenWidth,
    screenHeight: app.globalData.screenHeight,
    hide: false,
    bgimg: ''
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function(options) {
    this.backgroundImage()

    let month = new Date().getMonth() + 1
    //获取近七天的日期
    function getRecentDay(i) {
      let date = new Date()
      let date_ms = date.getTime() + 1000 * 60 * 60 * 24 * i
      date.setTime(date_ms)
      return date.getDate()
    }
    let days = []
    for (let i = new Date().getDay(); i > 0; i--) {
      days.push(getRecentDay(-i))
    }
    for (let i = 0; i < 7 - new Date().getDay(); i++) {
      days.push(getRecentDay(i))
    }
    /*获取标准格式课表信息：
    1）将课程名改为六个字以内
    2）上课地点六个字符以内
    3）在上课地点前加上@字符
    4）添加随机背景色属性/////改为根据课程名unicode字符取余算出颜色，以保证相同课程一样颜色
    */
    function getFormatCourse(course) {
      let formatCourse = []
      let random = Math.floor(Math.random() * 9)
      //由字符串Unicode算出颜色代码
      function getColorcode(str) {
        let unicode = 0
        for (let i = 0; i < str.length; i++) {
          unicode += str.charCodeAt(i)
        }
        let importantCode = unicode % 10
        let code = unicode / 1000 + (unicode / 10) % 100 + unicode % 10
        code *= Math.PI
        code = code / 100 + (code / 10) % 10 + code % 10 + importantCode
        code *= random //确保每次打开颜色变化
        code = Math.floor(code) % 7
        return code
      }
      for (let i = 0; i < course.length; i++) {
        let temp = []
        for (let j = 0; j < course[i].length; j++) {
          if (course[i][j] != null) {
            course[i][j].bg = colorlist[getColorcode(course[i][j].course_name)]
            course[i][j].course_name = String(course[i][j].course_name).slice(0, 6)
            course[i][j].location = course[i][j].location.slice(0, 6)
            course[i][j].at = '@'
          }
          temp.push(course[i][j])
        }
        formatCourse.push(temp)
      }
      return formatCourse
    }
    this.setData({
      course: getFormatCourse(app.globalData.course),
      month: month,
      days: days
    })
    this.dbMemo()
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function() {

  },

  //点击课表之后展示详细课表信息的事件
  showDetailCourse: function(e) {
    let i = e.currentTarget.dataset.i
    let j = e.currentTarget.dataset.j
    //有课显示课详细信息
    if (this.data.course[i][j] != null) {
      let thisCourse = wx.getStorageSync('course')[i][j]
      let detailCourse = {
        course_name: thisCourse.course_name,
        location: thisCourse.location,
        teacher: thisCourse.teacher,
        course_type: thisCourse.course_type,
        credit: thisCourse.credit,
        week: thisCourse.week
      }
      this.setData({
        detailCourse: detailCourse,
        detailShow: true
      })
    }
    //没课添加修改备忘
    else {
      memoI = i
      memoJ = j
      let content = null
      if (this.data.memos[i][j]) {
        content = this.data.memos[i][j].content
      }
      this.setData({
        inputBoxShow: true,
        content: content
      })
    }
  },
  hideDetailCourse: function() {
    this.setData({
      detailShow: false
    })
  },
  preventTouchMove: function() {
    //什么也不做来阻止滑动触摸传递
  },
  changeHide: function(e) {
    this.setData({
      hide: !this.data.hide
    })
  },
  //从缓存读取背景图片
  backgroundImage() {
    if (wx.getStorageSync('bgimg')) {
      wx.getStorage({
        key: 'bgimg',
        success: res => {
          this.setData({
            bgimg: res.data
          })
        }
      })
    }
  },
  cancel: function() {
    this.setData({
      inputBoxShow: false
    })
  },
  form: function(e) {
    let content = e.detail.value.content
    if (content.length > 12) {
      wx.showToast({
        title: '最多12个字符',
        image: '/images/failed.png'
      })
    } else {
      db.collection('memos').where({
        i: memoI,
        j: memoJ
      }).get({
        success: res => {
          if (res.data.length == 0) {
            if (content == '') {
              wx.showToast({
                title: '备忘不能为空',
                image: '/images/failed.png'
              })
            } else {
              db.collection('memos').add({
                data: {
                  content: content,
                  i: memoI,
                  j: memoJ
                },
                success: res => {
                  this.setData({
                    inputBoxShow: false
                  })
                  wx.showToast({
                    title: '添加成功~'
                  })
                  this.dbMemo()
                }
              })
            }
          } else {
            if (content == '') {
              wx.showModal({
                title: '确定吗？',
                content: '已有备忘，当前输入为空，该操作将会清空备忘',
                success: r => {
                  if (r.confirm) {
                    this.dbRemoveMemo(res.data[0]._id)
                  }
                }
              })
            } else {
              this.dbUpdateMemo(content, res.data[0]._id)
            }
          }
        }
      })
    }
  },
  dbRemoveMemo: function(id) {
    db.collection('memos').doc(id).remove({
      success: () => {
        this.setData({
          inputBoxShow: false
        })
        wx.showToast({
          title: '删除成功~'
        })
        this.dbMemo()
      }
    })
  },
  dbUpdateMemo: function(content, id) {
    db.collection('memos').doc(id).update({
      data: {
        content: content
      },
      success: () => {
        this.setData({
          inputBoxShow: false
        })
        wx.showToast({
          title: '修改成功~'
        })
        this.dbMemo()
      }
    })
  },
  //查询数据库备忘录
  dbMemo: function() {
    db.collection('memos').get({
      success: res => {
        let memos = []
        for (let i = 0; i < 7; i++) {
          let temp = []
          for (let j = 0; j < 6; j++) {
            temp.push(null)
          }
          memos.push(temp)
        }
        res.data.forEach(v => {
          memos[v.i][v.j] = {}
          memos[v.i][v.j].content = v.content
          memos[v.i][v.j].bg = colorlist[Math.floor(Math.random() * 7)]
        })
        this.setData({
          memos: memos
        })
      }
    })
  }
})
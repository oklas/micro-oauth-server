module.exports = ({micro, listen}) => ({
  getUrl: async fn => listen(micro(fn))
});
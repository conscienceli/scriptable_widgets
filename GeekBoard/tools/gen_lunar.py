import sxtwl, datetime, json
rows=[]
for y in range(2000, 2101):
    leap = sxtwl.getRunMonth(y)  # 0 if none
    months=[]  # (m, isLeap)
    for m in range(1,13):
        months.append((m,False))
        if leap==m: months.append((m,True))
    firsts=[]
    for m,l in months:
        d=sxtwl.fromLunar(y,m,1,l)
        firsts.append(datetime.date(d.getSolarYear(), d.getSolarMonth(), d.getSolarDay()))
    dn=sxtwl.fromLunar(y+1,1,1,False)
    firsts.append(datetime.date(dn.getSolarYear(), dn.getSolarMonth(), dn.getSolarDay()))
    lens=[(firsts[i+1]-firsts[i]).days for i in range(len(months))]
    assert all(l in (29,30) for l in lens), (y,lens)
    mask=0
    for i,l in enumerate(lens):
        if l==30: mask|=1<<i
    ny=firsts[0]
    doy=(ny-datetime.date(y,1,1)).days
    assert 0<=doy<64
    code=(doy<<17)|(leap<<13)|mask
    rows.append(code)
print(json.dumps(rows))

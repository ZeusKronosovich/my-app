import React from 'react';

const OrdersList = ({ orders }) => {
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU'); // Формат ДД.ММ.ГГГГ
    };

    const formatDateTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }); // Формат ДД.ММ.ГГГГ ЧЧ:ММ
    };

    return (
        <div>
            {orders && orders.length > 0 ? (
                <div style={{ height: '63vh', overflowY: 'auto', border: '1px solid #ccc' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', background: '#FFFFFF' }}>
                        <thead>
                            <tr>
                                <th style={{ border: '1px solid black', textAlign: 'center' }}>Номер заказа</th>
                                <th style={{ border: '1px solid black', textAlign: 'center' }}>Объем бетона</th>
                                <th style={{ border: '1px solid black', textAlign: 'center' }}>Марка бетона</th>
                                <th style={{ border: '1px solid black', textAlign: 'center' }}>Адрес доставки</th>
                                <th style={{ border: '1px solid black', textAlign: 'center' }}>Дата доставки</th>
                                <th style={{ border: '1px solid black', textAlign: 'center' }}>Время создания заказа</th>
                                <th style={{ border: '1px solid black', textAlign: 'center' }}>Стоимость заказа</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map(order => (
                                <tr key={order.o_number}>
                                    <td style={{ border: '1px solid black', textAlign: 'center' }}>{order.o_number}</td>
                                    <td style={{ border: '1px solid black', textAlign: 'center' }}>{order.o_betonv}</td>
                                    <td style={{ border: '1px solid black', textAlign: 'center' }}>{order.o_betonmark}</td>
                                    <td style={{ border: '1px solid black', textAlign: 'center' }}>{order.o_betontarget}</td>
                                    <td style={{ border: '1px solid black', textAlign: 'center' }}>{formatDate(order.o_betontime)}</td>
                                    <td style={{ border: '1px solid black', textAlign: 'center' }}>{formatDateTime(order.o_createdtime)}</td>
                                    <td style={{ border: '1px solid black', textAlign: 'center' }}>{order.o_price}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p style={{ textAlign: 'center' }}>Вы еще не сделали ни одного заказа!</p>
            )}
        </div>
    );
};

export default OrdersList;
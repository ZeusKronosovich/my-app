import React from 'react';

const OrdersList = ({ orders, onClose }) => {

    const safeOrders = Array.isArray(orders) ? orders : [];
    
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU');
    };

    const formatDateTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
    };

    const getStatusName = (status) => {
        const statusMap = {
            'pending': 'Ожидает',
            'in_progress': 'В процессе',
            'completed': 'Завершен',
            'cancelled': 'Отменен'
        };
        return statusMap[status] || status;
    };

    return (
        <div className="orders-list-overlay">
            <div className="orders-list-container">
                <div className="orders-list-header">
                    <h3>Мои заказы</h3>
                    <button onClick={onClose} className="close-orders-list">×</button>
                </div>
                <div className="orders-content">
                    {safeOrders.length > 0 ? (
                        <div className="orders-table-wrapper">
                            <table className="orders-table">
                                <thead>
                                    <tr>
                                        <th>Номер заказа</th>
                                        <th>Объем бетона</th>
                                        <th>Марка бетона</th>
                                        <th>Адрес доставки</th>
                                        <th>Дата доставки</th>
                                        <th>Время создания</th>
                                        <th>Стоимость</th>
                                        <th>Статус</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {safeOrders.map(order => (
                                        <tr key={order.o_number}>
                                            <td>{order.o_number}</td>
                                            <td>{order.o_betonv} м³</td>
                                            <td>{order.o_betonmark}</td>
                                            <td className="long-text">{order.o_betontarget}</td>
                                            <td>{formatDate(order.o_betontime)}</td>
                                            <td>{formatDateTime(order.o_createdtime)}</td>
                                            <td>{order.o_price} руб.</td>
                                            <td>
                                                <span className={`status-badge ${order.o_status}`}>
                                                    {getStatusName(order.o_status)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="no-orders-message">
                            <p>Вы еще не сделали ни одного заказа!</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OrdersList;